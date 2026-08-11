-- =============================================================================
-- Sentilyze — Supabase Veritabanı Şeması
-- =============================================================================
-- Mimari:
--   analysis_jobs  → Her analiz oturumunu temsil eder
--                    (1 YouTube URL, 1 manuel metin, N batch metin)
--   analysis_items → Bir job içindeki her bireysel metnin sonucu
--
-- v2: Dinamik duygu sistemi
--   - sentiment_label CHECK kısıtlaması kaldırıldı (model bağımsız)
--   - emotions_summary JSONB eklendi (herhangi sayıda duygu)
--   - Geriye dönük uyumluluk: positive/negative/neutral_count korunuyor
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. PROFILES — auth.users ile senkron kullanıcı profili
--    Auth trigger ile otomatik oluşturulur.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url   TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Yeni kullanıcı kayıt olduğunda otomatik profil oluştur
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ---------------------------------------------------------------------------
-- 2. ANALYSIS_JOBS — Her analiz oturumunun üst kaydı
--    job_type:
--      'manual'    → Tek metin, kullanıcı tarafından girildi
--      'batch'     → Çoklu metin (toplu yükleme)
--      'youtube'   → YouTube video yorum analizi
--      'ecommerce' → İleride: Trendyol/Hepsiburada ürün yorumları
--      'gmaps'     → İleride: Google Maps mekan yorumları
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_jobs (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

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
    -- Örn: {"joy": 45, "sadness": 12, "anger": 8} veya {"Olumlu": 50, "Olumsuz": 30, "Nötr": 20}
    emotions_summary JSONB,

    -- Performans
    fetch_time_ms   DECIMAL(10,2),
    analyze_time_ms DECIMAL(10,2),
    total_time_ms   DECIMAL(10,2),

    -- Gemini AI Özeti (pipeline'ın son adımı)
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
-- 3. ANALYSIS_ITEMS — Bir job içindeki her bireysel metnin sonucu
--    Manuel: 1 job → 1 item
--    YouTube: 1 job → N item (her yorum)
--    Batch:   1 job → N item
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_items (
    id      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id  UUID REFERENCES analysis_jobs(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id)    ON DELETE CASCADE NOT NULL,

    -- Analiz edilen metin
    analyzed_text TEXT NOT NULL,

    -- Duygu analizi sonucu
    -- CHECK kısıtlaması kaldırıldı: yeni model herhangi bir etiket döndürebilir
    sentiment_label  TEXT NOT NULL,        -- Örn: "joy", "anger", "Olumlu", vb.
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

    -- İleride: Gemini bu item için açıklama üretirse
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


-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);


-- analysis_jobs
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_select_own"
    ON analysis_jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "jobs_insert_own"
    ON analysis_jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "jobs_update_own"
    ON analysis_jobs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "jobs_delete_own"
    ON analysis_jobs FOR DELETE
    USING (auth.uid() = user_id);


-- analysis_items
ALTER TABLE analysis_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_select_own"
    ON analysis_items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "items_insert_own"
    ON analysis_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "items_delete_own"
    ON analysis_items FOR DELETE
    USING (auth.uid() = user_id);


-- =============================================================================
-- 5. FAYDALI VIEW — Dashboard için özet istatistik
--    Her kullanıcının son 30 günlük analizini gösterir.
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


-- =============================================================================
-- 6. MIGRATION: Mevcut veritabanına yeni sütunları ekle (zaten varsa hata vermez)
-- =============================================================================
-- Bu blok, mevcut Supabase'e yeni sütunları eklemek için çalıştırılır.
-- Yeni kurulumda yukarıdaki CREATE TABLE zaten kapsar, bu satırlar yedekdir.

ALTER TABLE analysis_jobs
    ADD COLUMN IF NOT EXISTS emotions_summary JSONB;

ALTER TABLE analysis_items
    ADD COLUMN IF NOT EXISTS emotion_scores JSONB;

-- sentiment_label üzerindeki eski CHECK kısıtlamasını kaldır (varsa)
DO $$
DECLARE
    v_constraint TEXT;
BEGIN
    SELECT conname INTO v_constraint
    FROM pg_constraint
    WHERE conrelid = 'analysis_items'::regclass
      AND contype = 'c'
      AND conname LIKE '%sentiment_label%';
    IF v_constraint IS NOT NULL THEN
        EXECUTE 'ALTER TABLE analysis_items DROP CONSTRAINT ' || v_constraint;
    END IF;
END;
$$;
