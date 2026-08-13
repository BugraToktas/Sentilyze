/**
 * use-live-stream.ts — Sentilyze Canlı Yayın SSE Hook'u
 *
 * YouTube canlı yayın chat analizini başlatır, SSE akışını dinler
 * ve gerçek zamanlı DataPoint'leri state olarak tutar.
 *
 * Kullanım:
 *   const { start, stop, dataPoints, isLive, sessionInfo, error } = useLiveStream();
 *
 * NOT: sse_starlette kütüphanesi her satıra "data: " prefix'i ekler.
 * Bu yüzden raw satırları "data: " prefix'ini soyarak parse etmek gerekiyor.
 * Örnek: "data: event: status" → gerçek içerik: "event: status"
 */

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { DataPoint } from '@/components/EmotionLineChart';

const BASE_URL =
    (process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

// ─── Tip tanımları ──────────────────────────────────────────────────────────
export interface SessionInfo {
    session_id: string;
    video_id: string;
    video_title: string;
    channel: string;
    live_chat_id: string;
    stream_url: string;
}

export type LiveStatus = 'idle' | 'starting' | 'live' | 'stopped' | 'error';

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useLiveStream() {
    const { session } = useAuth();

    const [status, setStatus]               = useState<LiveStatus>('idle');
    const [sessionInfo, setSessionInfo]     = useState<SessionInfo | null>(null);
    const [dataPoints, setDataPoints]       = useState<DataPoint[]>([]);
    const [error, setError]                 = useState<string | null>(null);
    const [totalMessages, setTotalMessages] = useState(0);
    const [recentMessages, setRecentMessages] = useState<{text: string; emotion: string}[]>([]);

    const eventSourceRef   = useRef<EventSource | null>(null);
    const sessionIdRef     = useRef<string | null>(null);
    const sessionInfoRef   = useRef<SessionInfo | null>(null);
    const dataPointsRef    = useRef<DataPoint[]>([]);
    const totalMessagesRef = useRef<number>(0);

    // ── SSE bağlantısını kur ─────────────────────────────────────────────────
    const connectSSE = useCallback((sessionId: string) => {
        const url = `${BASE_URL}/api/v1/live/youtube/stream/${sessionId}`;
        const controller = new AbortController();

        (async () => {
            try {
                const headers: Record<string, string> = {
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                };
                if (session?.access_token) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
                }

                const res = await fetch(url, {
                    headers,
                    signal: controller.signal,
                });

                if (!res.ok) {
                    setError(`SSE bağlantısı kurulamadı: ${res.status}`);
                    setStatus('error');
                    return;
                }

                const reader = res.body?.getReader();
                if (!reader) return;

                const decoder = new TextDecoder();
                let buffer = '';
                // Oturum boyunca toplam mesaj sayısı
                let sessionTotal = 0;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';

                    let eventType = '';
                    let dataStr   = '';

                    for (const line of lines) {
                        // sse_starlette her satıra "data: " prefix'i ekliyor.
                        // Gerçek içeriğe ulaşmak için prefix'i soyuyoruz.
                        // Örnek: "data: event: datapoint" → "event: datapoint"
                        //        "data: data: {...}"      → "data: {...}"
                        //        "data: "                 → "" (boş = event sonu)
                        const stripped = line.startsWith('data: ') ? line.slice(6) : line;

                        if (stripped.startsWith('event: ')) {
                            eventType = stripped.slice(7).trim();
                        } else if (stripped.startsWith('data: ')) {
                            dataStr = stripped.slice(6).trim();
                        } else if (stripped.trim() === '') {
                            // Boş satır = event sonu
                            if (eventType && dataStr) {
                                try {
                                    const parsed = JSON.parse(dataStr);

                                    switch (eventType) {
                                        case 'status':
                                            setStatus(parsed.status === 'running' ? 'live' : parsed.status);
                                            break;

                                        case 'datapoint':
                                            setDataPoints(prev => {
                                                const idx = prev.findIndex(p => p.bucket_sec === parsed.bucket_sec);
                                                let next: DataPoint[];
                                                if (idx >= 0) {
                                                    const updated = [...prev];
                                                    updated[idx] = parsed;
                                                    next = updated;
                                                } else {
                                                    next = [...prev, parsed].sort((a, b) => a.bucket_sec - b.bucket_sec);
                                                }
                                                dataPointsRef.current = next;
                                                return next;
                                            });
                                            if (parsed.sample_messages?.length) {
                                                setRecentMessages(prev => {
                                                    const newMsgs = (parsed.sample_messages as string[]).map((t: string) => ({
                                                        text: t,
                                                        emotion: parsed.dominant,
                                                    }));
                                                    return [...newMsgs, ...prev].slice(0, 15);
                                                });
                                            }
                                            if (parsed.total_messages != null) {
                                                sessionTotal = parsed.total_messages;
                                            } else {
                                                sessionTotal += (parsed.message_count ?? 0);
                                            }
                                            totalMessagesRef.current = sessionTotal;
                                            setTotalMessages(sessionTotal);
                                            setStatus('live');
                                            break;

                                        case 'ended':
                                            setStatus('stopped');
                                            if (parsed.data_points) {
                                                setDataPoints(parsed.data_points);
                                                dataPointsRef.current = parsed.data_points;
                                            }
                                            if (parsed.total_messages != null) {
                                                setTotalMessages(parsed.total_messages);
                                                totalMessagesRef.current = parsed.total_messages;
                                            }
                                            // Supabase'e kaydet
                                            if (sessionInfoRef.current) {
                                                saveLiveSession(
                                                    sessionInfoRef.current,
                                                    parsed.data_points ?? dataPointsRef.current,
                                                    parsed.total_messages ?? totalMessagesRef.current,
                                                );
                                            }
                                            break;
                                    }
                                } catch {
                                    // Heartbeat veya parse hatası — sessizce geç
                                }
                            }
                            eventType = '';
                            dataStr   = '';
                        }
                    }
                }
            } catch (err: unknown) {
                if ((err as Error)?.name === 'AbortError') return;
                setError(`Bağlantı hatası: ${(err as Error)?.message}`);
                setStatus('error');
            }
        })();

        eventSourceRef.current = { close: () => controller.abort() } as unknown as EventSource;
    }, [session]);

    // ── Supabase'e live session kaydet ───────────────────────────────────────
    const saveLiveSession = useCallback(async (
        info: SessionInfo,
        pts: DataPoint[],
        msgCount: number,
    ) => {
        if (!session?.user?.id) return;
        try {
            // Baskın duyguyu hesapla
            const emotionTotals: Record<string, number> = {};
            for (const pt of pts) {
                for (const [k, v] of Object.entries(pt.emotions)) {
                    emotionTotals[k] = (emotionTotals[k] ?? 0) + v;
                }
            }
            const peakEmotion = Object.keys(emotionTotals).length > 0
                ? Object.keys(emotionTotals).reduce((a, b) => emotionTotals[a] > emotionTotals[b] ? a : b)
                : null;
            const lastBucket = pts.length > 0 ? pts[pts.length - 1].bucket_sec : 0;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('live_sessions') as any).insert({
                user_id:          session.user.id,
                platform:         'youtube',
                video_id:         info.video_id,
                video_title:      info.video_title,
                channel_name:     info.channel,
                stream_url:       `https://www.youtube.com/watch?v=${info.video_id}`,
                total_messages:   msgCount,
                total_buckets:    pts.length,
                peak_emotion:     peakEmotion,
                duration_secs:    lastBucket + 10,
                emotions_timeline: pts,
                ended_at:         new Date().toISOString(),
            });
        } catch (e) {
            console.warn('[LiveStream] Supabase kayıt hatası:', e);
        }
    }, [session]);

    // ── Analizi Başlat ───────────────────────────────────────────────────────
    const start = useCallback(async (youtubeUrl: string) => {
        setError(null);
        setDataPoints([]);
        setTotalMessages(0);
        setSessionInfo(null);
        setRecentMessages([]);
        setStatus('starting');

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const res = await fetch(`${BASE_URL}/api/v1/live/youtube/start`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ url: youtubeUrl, max_duration_minutes: 60 }),
            });

            const json = await res.json();

            if (!res.ok) {
                setError(json?.detail ?? `Sunucu hatası: ${res.status}`);
                setStatus('error');
                return;
            }

            const info: SessionInfo = json;
            setSessionInfo(info);
            sessionInfoRef.current = info;
            sessionIdRef.current = info.session_id;
            setStatus('live');
            connectSSE(info.session_id);

        } catch (err: unknown) {
            setError((err as Error)?.message ?? 'Bağlantı kurulamadı');
            setStatus('error');
        }
    }, [session, connectSSE]);

    // ── Analizi Durdur ───────────────────────────────────────────────────────
    const stop = useCallback(async () => {
        eventSourceRef.current?.close();
        eventSourceRef.current = null;

        const sid  = sessionIdRef.current;
        const info = sessionInfoRef.current;
        if (!sid) {
            setStatus('idle');
            return;
        }

        // Kullanıcı manuel durdurduysa Supabase'e kaydet
        if (info) {
            saveLiveSession(info, dataPointsRef.current, totalMessagesRef.current);
        }

        try {
            await fetch(`${BASE_URL}/api/v1/live/youtube/stop/${sid}`, {
                method: 'DELETE',
                headers: session?.access_token
                    ? { 'Authorization': `Bearer ${session.access_token}` }
                    : {},
            });
        } catch {
            // Sessizce hata
        }

        setStatus('stopped');
        sessionIdRef.current = null;
    }, [session]);

    // ── Sıfırla ─────────────────────────────────────────────────────────────
    const reset = useCallback(() => {
        eventSourceRef.current?.close();
        eventSourceRef.current   = null;
        sessionIdRef.current     = null;
        sessionInfoRef.current   = null;
        dataPointsRef.current    = [];
        totalMessagesRef.current = 0;
        setStatus('idle');
        setDataPoints([]);
        setSessionInfo(null);
        setError(null);
        setTotalMessages(0);
        setRecentMessages([]);
    }, []);

    return {
        start,
        stop,
        reset,
        status,
        isLive:       status === 'live',
        isLoading:    status === 'starting',
        dataPoints,
        sessionInfo,
        totalMessages,
        recentMessages,
        error,
    };
}
