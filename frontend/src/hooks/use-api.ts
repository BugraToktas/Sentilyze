/**
 * use-api.ts — TriSential Backend API Hook
 *
 * Backend URL'yi env'den okur; yoksa localhost fallback kullanır.
 * Supabase session token'ını Authorization header'a ekler.
 */

import { useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';

const BASE_URL =
    (process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

// ---- Tip tanımları -----------------------------------------------------------

export interface SingleAnalysisResult {
    label: 'Olumlu' | 'Olumsuz' | 'Nötr';
    confidence: number;
    process_time_ms: number;
    text: string;
}

export interface BatchItem {
    text: string;
    label: 'Olumlu' | 'Olumsuz' | 'Nötr';
    confidence: number;
}

export interface YoutubeComment {
    text: string;
    author: string;
    like_count: number;
    published_at: string;
    label: 'Olumlu' | 'Olumsuz' | 'Nötr';
    confidence: number;
}

export interface SentimentBreakdown {
    count: number;
    percentage: number;
}

export interface YoutubeAnalysisResult {
    video_info: {
        title: string;
        channel_title: string;
        view_count: string;
        video_id: string;
    };
    summary: {
        total_fetched: number;
        total_analyzed: number;
        skipped: number;
        breakdown: {
            Olumlu: SentimentBreakdown;
            Olumsuz: SentimentBreakdown;
            Nötr: SentimentBreakdown;
        };
    };
    performance: {
        fetch_time_ms: number;
        analyze_time_ms: number;
        total_time_ms: number;
    };
    data: YoutubeComment[];
}

// ---- Hook -------------------------------------------------------------------

export function useApi() {
    const { session } = useAuth();

    const post = useCallback(
        async <T>(path: string, body: unknown): Promise<{ data: T | null; error: string | null }> => {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                };
                if (session?.access_token) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
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
        [session]
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
