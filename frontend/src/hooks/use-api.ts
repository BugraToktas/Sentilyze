/**
 * use-api.ts — Sentilyze Backend API Hook
 *
 * Backend URL'yi env'den okur; yoksa localhost fallback kullanır.
 * Strapi JWT token'ını Authorization header'a ekler.
 *
 * v2: Artık sabit 3 sınıf yerine dinamik emotion etiket sistemi kullanılır.
 * Model hangi etiket döndürürse döndürsün tip güvenliyle çalışır.
 */

import { useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';

const BASE_URL =
    (process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

// ─── Tip tanımları ─────────────────────────────────────────────────────────────

/** Modelin döndürdüğü herhangi bir duygu etiketi (string — model bağımsız) */
export type EmotionLabel = string;

/** Tek metin analiz sonucu */
export interface SingleAnalysisResult {
    /** Modelin belirlediği baskın duygu etiketi */
    label: EmotionLabel;
    /** Baskın etiketin güven skoru (0–100) */
    confidence: number;
    process_time_ms: number;
    text: string;
    /**
     * Opsiyonel: Çok-sınıflı model ise tüm duygu skorları
     * { "joy": 72.5, "sadness": 12.3, "anger": 8.1, ... }
     */
    scores?: Record<EmotionLabel, number>;
}

/** Toplu analiz tek satır sonucu */
export interface BatchItem {
    text: string;
    label: EmotionLabel;
    confidence: number;
    scores?: Record<EmotionLabel, number>;
}

/** YouTube yorumu analiz sonucu */
export interface YoutubeComment {
    text: string;
    author: string;
    like_count: number;
    published_at: string;
    label: EmotionLabel;
    confidence: number;
    scores?: Record<EmotionLabel, number>;
}

/** Duygu dağılım istatistiği (herhangi bir etiket için) */
export interface EmotionBreakdown {
    count: number;
    percentage: number;
}

/** YouTube analiz sonucu (v2 — dinamik breakdown) */
export interface YoutubeAnalysisResult {
    video_info: {
        title: string;
        channel_title?: string;
        channel?: string;
        view_count: string;
        video_id: string;
        comment_count?: number;
        like_count?: number;
    };
    summary: {
        total_fetched: number;
        total_analyzed: number;
        skipped: number;
        /**
         * Dinamik breakdown: model hangi etiket döndürürse o burada olur.
         * Örn: { "joy": {...}, "anger": {...} }
         *   veya (eski model): { "Olumlu": {...}, "Olumsuz": {...}, "Nötr": {...} }
         */
        breakdown: Record<EmotionLabel, EmotionBreakdown>;
        /** Tüm analizlerin ağırlıklı ortalaması (opsiyonel) */
        avg_scores?: Record<EmotionLabel, number>;
    };
    performance: {
        fetch_time_ms: number;
        analyze_time_ms: number;
        total_time_ms: number;
    };
    data: YoutubeComment[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useApi() {
    const { jwt } = useAuth();

    const post = useCallback(
        async <T>(path: string, body: unknown): Promise<{ data: T | null; error: string | null }> => {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                };
                if (jwt) {
                    headers['Authorization'] = `Bearer ${jwt}`;
                }

                const res = await fetch(`${BASE_URL}${path}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });

                const json = await res.json();

                if (!res.ok) {
                    return {
                        data: null,
                        error: json?.detail ?? `Sunucu hatası: ${res.status}`,
                    };
                }

                return { data: json as T, error: null };
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Ağ bağlantısı hatası';
                return { data: null, error: msg };
            }
        },
        [jwt]
    );

    /** Tekil metin analizi */
    const analyzeSingle = useCallback(
        (text: string) =>
            post<{ status: string; data: SingleAnalysisResult }>('/api/v1/analyze', { text }),
        [post]
    );

    /** Toplu metin analizi */
    const analyzeBatch = useCallback(
        (texts: string[]) =>
            post<{ status: string; count: number; process_time_ms: number; data: BatchItem[] }>(
                '/api/v1/analyze/batch',
                { texts }
            ),
        [post]
    );

    /** YouTube URL analizi */
    const analyzeYoutube = useCallback(
        (url: string, maxComments = 200) =>
            post<YoutubeAnalysisResult>('/api/v1/fetch-and-analyze/youtube', {
                url,
                max_comments: maxComments,
                order: 'relevance',
                include_replies: false,
            }),
        [post]
    );

    return { analyzeSingle, analyzeBatch, analyzeYoutube };
}
