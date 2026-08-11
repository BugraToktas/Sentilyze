// =============================================================================
// Sentilyze — Supabase Veritabanı TypeScript Tipleri
// Bu dosya createClient<Database> için gerekli — diğer her şeye buradan import et.
// v2: SentimentLabel artık açık string (model bağımsız), emotions_summary JSONB eklendi.
// =============================================================================

export type JobType      = 'manual' | 'batch' | 'youtube' | 'ecommerce' | 'gmaps';
export type JobStatus    = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * v2: Duygu etiketi artık sabit 3 değere bağlı değil.
 * Model hangi etiket döndürürse döndürsün string olarak saklanır.
 * Örnekler: "joy", "anger", "Olumlu", "Olumsuz", "Nötr", "sadness" ...
 */
export type EmotionLabel = string;

/** Geriye dönük uyumluluk için — eski kayıtlar hâlâ bu tipi kullanıyor */
export type SentimentLabel = EmotionLabel;

export type SourceCategory = 'ecommerce' | 'location' | 'other';

// ---------------------------------------------------------------------------
// Tablo row tipleri (veritabanından okunan ham veri)
// ---------------------------------------------------------------------------

export interface Profile {
    id:           string;
    display_name: string | null;
    avatar_url:   string | null;
    created_at:   string;
    updated_at:   string;
}

export interface AnalysisJob {
    id:      string;
    user_id: string;

    job_type: JobType;
    status:   JobStatus;

    // YouTube metadata
    youtube_url:          string | null;
    youtube_video_id:     string | null;
    youtube_video_title:  string | null;
    youtube_channel_name: string | null;
    youtube_view_count:   number | null;

    // İleride: e-ticaret / Google Maps
    source_url:  string | null;
    source_name: string | null;

    // v2: Dinamik duygu özeti — {"joy": 45, "sadness": 12} vb.
    emotions_summary: Record<EmotionLabel, number> | null;

    // Geriye dönük uyumluluk (eski kayıtlar için)
    total_analyzed: number;
    total_skipped:  number;
    positive_count: number;
    negative_count: number;
    neutral_count:  number;

    // Performans
    fetch_time_ms:   number | null;
    analyze_time_ms: number | null;
    total_time_ms:   number | null;

    // Gemini AI Özeti
    ai_summary:               string | null;
    ai_summary_generated_at:  string | null;
    ai_summary_model:         string | null;

    created_at: string;
}

export interface AnalysisItem {
    id:      string;
    job_id:  string;
    user_id: string;

    analyzed_text:    string;
    sentiment_label:  EmotionLabel;   // artık serbest string
    confidence_score: number;
    process_time_ms:  number | null;

    // v2: Multi-label model skorları — {"joy": 72.5, "sadness": 15.3, ...}
    emotion_scores: Record<EmotionLabel, number> | null;

    source_category:  SourceCategory | null;

    // YouTube yorum metadata
    youtube_author:       string | null;
    youtube_like_count:   number | null;
    youtube_published_at: string | null;

    // Gemini item notu (ileride)
    ai_note: string | null;

    created_at: string;
}

// ---------------------------------------------------------------------------
// View tipi — Dashboard özet istatistiği
// ---------------------------------------------------------------------------

export interface UserStats {
    user_id:              string;
    total_jobs:           number;
    total_texts_analyzed: number;
    total_positive:       number;
    total_negative:       number;
    total_neutral:        number;
    youtube_jobs:         number;
    manual_jobs:          number;
    batch_jobs:           number;
    ai_summarized_jobs:   number;
    last_analysis_at:     string | null;
}

// ---------------------------------------------------------------------------
// Supabase Database tip tanımı — createClient<Database> için
// Supabase'in beklediği tam yapı: Tables, Views, Functions, Enums
// ---------------------------------------------------------------------------

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row:    Profile;
                Insert: Partial<Profile>;
                Update: Partial<Profile>;
            };
            analysis_jobs: {
                Row: AnalysisJob;
                Insert: {
                    id?:      string;
                    user_id:  string;
                    job_type: JobType;
                    status?:  JobStatus;

                    youtube_url?:          string | null;
                    youtube_video_id?:     string | null;
                    youtube_video_title?:  string | null;
                    youtube_channel_name?: string | null;
                    youtube_view_count?:   number | null;

                    source_url?:  string | null;
                    source_name?: string | null;

                    // v2: dinamik duygu özeti
                    emotions_summary?: Record<EmotionLabel, number> | null;

                    // Geriye dönük uyumluluk
                    total_analyzed?: number;
                    total_skipped?:  number;
                    positive_count?: number;
                    negative_count?: number;
                    neutral_count?:  number;

                    fetch_time_ms?:   number | null;
                    analyze_time_ms?: number | null;
                    total_time_ms?:   number | null;

                    ai_summary?:              string | null;
                    ai_summary_generated_at?: string | null;
                    ai_summary_model?:        string | null;

                    created_at?: string;
                };
                Update: Partial<AnalysisJob>;
            };
            analysis_items: {
                Row: AnalysisItem;
                Insert: {
                    id?:      string;
                    job_id:   string;
                    user_id:  string;

                    analyzed_text:    string;
                    sentiment_label:  EmotionLabel;   // serbest string
                    confidence_score: number;
                    process_time_ms?: number | null;

                    // v2: tüm duygu skorları
                    emotion_scores?: Record<EmotionLabel, number> | null;

                    source_category?: SourceCategory | null;

                    youtube_author?:       string | null;
                    youtube_like_count?:   number | null;
                    youtube_published_at?: string | null;

                    ai_note?: string | null;
                    created_at?: string;
                };
                Update: Partial<AnalysisItem>;
            };
        };
        Views: {
            user_stats: {
                Row: UserStats;
            };
        };
        Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
        Enums:     Record<string, string>;
    };
}
