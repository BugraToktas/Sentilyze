-- =============================================================================
-- Sentilyze — PostgreSQL Veritabanı Şeması
-- =============================================================================
-- Mimari:
--   Bu şema, Strapi (Node.js) backend ile kullanılmak üzere tasarlanmıştır.
--   Auth yönetimi Strapi'nin kendi tabloları (strapi_users / up_users) tarafından
--   yapılır. Bu tablolar Strapi tarafından otomatik oluşturulur.
--
--   Bu dosyadaki tablolar Strapi Content Type olarak da tanımlanacak;
--   ancak Strapi'nin üretemediği özel sütunlar için bu schema kullanılır.
--
--   analysis_jobs  → Her analiz oturumunu temsil eder
--   analysis_items → Bir job içindeki her bireysel metnin sonucu
--   live_sessions  → Canlı yayın oturumları
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ANALYSIS_JOBS — Her analiz oturumunun üst kaydı
--    job_type:
--      'manual'    → Tek metin, kullanıcı tarafından girildi
--      'batch'     → Çoklu metin (toplu yükleme)
--      'youtube'   → YouTube video yorum analizi
--      'ecommerce' → İleride: Trendyol/Hepsiburada ürün yorumları
--      'gmaps'     → İleride: Google Maps mekan yorumları
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_jobs (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    -- Strapi user ID (integer — Strapi up_users.id)
    user_id     INTEGER     NOT NULL,

    -- Analiz tipi
    job_type    VARCHAR(20) NOT NULL
                CHECK (job_type IN ('manual', 'batch', 'youtube', 'ecommerce', 'gmaps')),

    -- İşlem durumu
    status      VARCHAR(20) NOT NULL DEFAULT 'completed'
                CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

    -- YouTube'a özgü metadata
    youtube_url          TEXT,
    youtube_video_id     VARCHAR(30),
    youtube_video_title  TEXT,
    youtube_channel_name TEXT,
    youtube_view_count   BIGINT,

    -- İleride: E-ticaret/Google Maps özgü metadata
    source_url    TEXT,
    source_name   TEXT,

    -- Aggregate sonuçlar (geriye dönük uyumluluk için eski sütunlar korunuyor)
    total_analyzed  INT DEFAULT 0,
    total_skipped   INT DEFAULT 0,
    positive_count  INT DEFAULT 0,
    negative_count  INT DEFAULT 0,
    neutral_count   INT DEFAULT 0,

    -- v2: Dinamik duygu özeti (JSONB — herhangi sayıda duygu)
    -- Örn: {"joy": 45, "sadness": 12, "anger": 8}
    emotions_summary JSONB,

    -- Performans
    fetch_time_ms   DECIMAL(10,2),
    analyze_time_ms DECIMAL(10,2),
    total_time_ms   DECIMAL(10,2),

    -- AI Özeti
    ai_summary              TEXT,
    ai_summary_generated_at TIMESTAMPTZ,
    ai_summary_model        VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_jobs_user_created
    ON analysis_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_type
    ON analysis_jobs(job_type);

CREATE INDEX IF NOT EXISTS idx_jobs_status
    ON analysis_jobs(status);


-- ---------------------------------------------------------------------------
-- 2. ANALYSIS_ITEMS — Bir job içindeki her bireysel metnin sonucu
--    Manuel: 1 job → 1 item
--    YouTube: 1 job → N item (her yorum)
--    Batch:   1 job → N item
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_items (
    id      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id  UUID REFERENCES analysis_jobs(id) ON DELETE CASCADE NOT NULL,
    user_id INTEGER NOT NULL,

    -- Analiz edilen metin
    analyzed_text TEXT NOT NULL,

    -- Duygu analizi sonucu
    sentiment_label  TEXT NOT NULL,
    confidence_score DECIMAL(5,2) NOT NULL
                     CHECK (confidence_score >= 0 AND confidence_score <= 100),
    process_time_ms  DECIMAL(8,2),

    -- Tüm duygu skorları (JSONB — multi-label model desteği)
    -- Örn: {"joy": 72.5, "sadness": 15.3, "anger": 8.1, ...}
    emotion_scores   JSONB,

    -- Manuel/Batch analizde kaynak kategorisi
    source_category VARCHAR(20)
                    CHECK (source_category IN ('ecommerce', 'location', 'other')),

    -- YouTube yorumuna özgü metadata
    youtube_author       TEXT,
    youtube_like_count   INT,
    youtube_published_at TIMESTAMPTZ,

    -- AI notu
    ai_note TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_items_job_id
    ON analysis_items(job_id);

CREATE INDEX IF NOT EXISTS idx_items_user_id
    ON analysis_items(user_id);

CREATE INDEX IF NOT EXISTS idx_items_sentiment
    ON analysis_items(sentiment_label);

CREATE INDEX IF NOT EXISTS idx_items_job_sentiment
    ON analysis_items(job_id, sentiment_label);


-- ---------------------------------------------------------------------------
-- 3. LIVE_SESSIONS — Canlı Yayın Oturumları (YouTube Live / Twitch)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_sessions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         INTEGER NOT NULL,

    -- Platform
    platform        TEXT NOT NULL DEFAULT 'youtube'
                    CHECK (platform IN ('youtube', 'twitch', 'kick')),

    -- Yayın bilgileri
    video_id        TEXT,
    video_title     TEXT,
    channel_name    TEXT,
    stream_url      TEXT,

    -- Analiz özeti
    total_messages  INT DEFAULT 0,
    total_buckets   INT DEFAULT 0,
    peak_emotion    TEXT,
    duration_secs   INT,

    -- Tam zaman serisi verisi (JSONB)
    -- [{ bucket_sec, message_count, emotions: {...}, dominant }, ...]
    emotions_timeline JSONB,

    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS live_sessions_user_id_idx ON live_sessions(user_id);
CREATE INDEX IF NOT EXISTS live_sessions_created_at_idx ON live_sessions(created_at DESC);


-- =============================================================================
-- 4. FAYDALI VIEW — Dashboard için özet istatistik
-- =============================================================================
CREATE OR REPLACE VIEW user_stats AS
SELECT
    j.user_id,
    COUNT(DISTINCT j.id)        AS total_jobs,
    SUM(j.total_analyzed)       AS total_texts_analyzed,
    SUM(j.positive_count)       AS total_positive,
    SUM(j.negative_count)       AS total_negative,
    SUM(j.neutral_count)        AS total_neutral,
    COUNT(DISTINCT j.id) FILTER (WHERE j.job_type = 'youtube')   AS youtube_jobs,
    COUNT(DISTINCT j.id) FILTER (WHERE j.job_type = 'manual')    AS manual_jobs,
    COUNT(DISTINCT j.id) FILTER (WHERE j.job_type = 'batch')     AS batch_jobs,
    COUNT(DISTINCT j.id) FILTER (WHERE j.ai_summary IS NOT NULL) AS ai_summarized_jobs,
    MAX(j.created_at)           AS last_analysis_at
FROM analysis_jobs j
WHERE j.created_at >= NOW() - INTERVAL '30 days'
  AND j.status = 'completed'
GROUP BY j.user_id;
