/**
 * dashboard.tsx — Sentilyze Ana Ekranı
 *
 * 4 sekme:
 *   1. Analiz   → Manuel metin & toplu analiz
 *   2. YouTube  → YouTube URL analizi
 *   3. Geçmiş   → Supabase'den past analysis_jobs
 *   4. Profil   → Kullanıcı bilgisi + çıkış
 *
 * v2: Artık sabit Olumlu/Olumsuz/Nötr yerine dinamik emotion sistemi
 *     kullanılıyor. getEmotionMeta() ile herhangi bir model etiketi
 *     otomatik olarak renk/emoji/Türkçe label'a çevrilir.
 */

import { useState, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
    Dimensions,
    FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/use-auth';
import { useApi, type SingleAnalysisResult, type YoutubeAnalysisResult } from '@/hooks/use-api';
import { Brand, getEmotionMeta } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import LiveScreen from '@/app/(app)/live';
import EmotionLineChart from '@/components/EmotionLineChart';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Alt Sekme Tipi ─────────────────────────────────────────────────────────
type Tab = 'analyze' | 'youtube' | 'live' | 'history' | 'profile';

// ─── Geçmiş iş tipi ────────────────────────────────────────────────────────
interface HistoryJob {
    id: string;
    job_type: string;
    youtube_video_title: string | null;
    total_analyzed: number;
    emotions_summary: Record<string, number> | null;
    // Geriye dönük uyumluluk (eski kayıtlar için)
    positive_count: number;
    negative_count: number;
    neutral_count: number;
    created_at: string;
    // Tip ayırıcı
    _source: 'job';
}

// ─── Canlı yayın geçmiş tipi ──────────────────────────────────────────
interface LiveHistoryJob {
    id: string;
    platform: string;
    video_id: string | null;
    video_title: string | null;
    channel_name: string | null;
    total_messages: number;
    total_buckets: number;
    peak_emotion: string | null;
    duration_secs: number | null;
    emotions_timeline: Array<{ bucket_sec: number; message_count: number; emotions: Record<string, number>; dominant: string }> | null;
    created_at: string;
    _source: 'live';
}

// ─── Circular Progress ─────────────────────────────────────────────────────
function CircleProgress({ value, color, label }: { value: number; color: string; label: string }) {
    return (
        <View style={circleStyles.wrap}>
            <View style={[circleStyles.ring, { borderColor: 'rgba(255,255,255,0.06)' }]}>
                <View
                    style={[
                        circleStyles.innerRing,
                        {
                            borderColor: color,
                            borderTopColor: 'transparent',
                            transform: [{ rotate: `${(value / 100) * 360}deg` }],
                        },
                    ]}
                />
                <Text style={[circleStyles.percent, { color }]}>{Math.round(value)}%</Text>
            </View>
            <Text style={circleStyles.label}>{label}</Text>
        </View>
    );
}

const circleStyles = StyleSheet.create({
    wrap: { alignItems: 'center', gap: 6 },
    ring: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    innerRing: {
        position: 'absolute',
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
    },
    percent: { fontSize: 13, fontWeight: '700' },
    label: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
});

// ─── Duygu Çubuğu (herhangi etiket için) ───────────────────────────────────
function EmotionBar({
    label,
    count,
    total,
    color,
}: {
    label: string;
    count: number;
    total: number;
    color: string;
}) {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return (
        <View style={barStyles.row}>
            <Text style={barStyles.labelText}>{label}</Text>
            <View style={barStyles.track}>
                <View style={[barStyles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
            </View>
            <Text style={[barStyles.countText, { color }]}>{count}</Text>
        </View>
    );
}

const barStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    labelText: { width: 72, fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
    track: {
        flex: 1,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: 4 },
    countText: { width: 32, fontSize: 12, fontWeight: '700', textAlign: 'right' },
});

// ─── Ana Bileşen ────────────────────────────────────────────────────────────
export default function DashboardScreen() {
    const { user, signOut } = useAuth();
    const { analyzeSingle, analyzeBatch, analyzeYoutube } = useApi();

    const [activeTab, setActiveTab] = useState<Tab>('analyze');

    // ── Analiz metin state (tekil ve toplu aynı textarea'ı paylaşır) ──
    const [sharedText, setSharedText] = useState('');
    const [manualLoading, setManualLoading] = useState(false);
    const [manualResult, setManualResult] = useState<SingleAnalysisResult | null>(null);
    const [manualError, setManualError] = useState<string | null>(null);

    // ── Toplu Analiz state ──
    const [batchMode, setBatchMode] = useState(false);
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchResults, setBatchResults] = useState<{ text: string; label: string; confidence: number; scores?: Record<string, number> }[] | null>(null);
    const [batchError, setBatchError] = useState<string | null>(null);

    // ── YouTube state ──
    const [ytUrl, setYtUrl] = useState('');
    const [ytMaxComments, setYtMaxComments] = useState('100');
    const [ytLoading, setYtLoading] = useState(false);
    const [ytResult, setYtResult] = useState<YoutubeAnalysisResult | null>(null);
    const [ytError, setYtError] = useState<string | null>(null);

    // ── Geçmiş state ──
    const [history, setHistory] = useState<(HistoryJob | LiveHistoryJob)[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // ── Geçmiş yükleme: analysis_jobs + live_sessions birleştir ──
    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);

        // 1. analysis_jobs
        const { data: jobs } = await supabase
            .from('analysis_jobs')
            .select(
                'id, job_type, youtube_video_title, total_analyzed, emotions_summary, positive_count, negative_count, neutral_count, created_at'
            )
            .order('created_at', { ascending: false })
            .limit(20);

        // 2. live_sessions
        const { data: liveSessions } = await supabase
            .from('live_sessions')
            .select(
                'id, platform, video_id, video_title, channel_name, total_messages, total_buckets, peak_emotion, duration_secs, emotions_timeline, created_at'
            )
            .order('created_at', { ascending: false })
            .limit(10);

        // 3. Birleştir ve tarihe göre sırala
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const jobItems: HistoryJob[] = (jobs ?? []).map((j: any) => ({ ...j, _source: 'job' as const }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const liveItems: LiveHistoryJob[] = (liveSessions ?? []).map((l: any) => ({ ...l, _source: 'live' as const }));
        const merged = [...jobItems, ...liveItems].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setHistoryLoading(false);
        setHistory(merged);
    }, []);


    useFocusEffect(
        useCallback(() => {
            if (activeTab === 'history') loadHistory();
        }, [activeTab, loadHistory])
    );

    // ── Tekil analiz ──
    const handleManualAnalyze = async () => {
        if (!sharedText.trim()) {
            setManualError('Lütfen analiz edilecek metni girin.');
            return;
        }
        setManualError(null);
        setManualResult(null);
        setManualLoading(true);

        const { data, error } = await analyzeSingle(sharedText.trim());
        setManualLoading(false);

        if (error) {
            setManualError(error);
        } else if (data?.data) {
            setManualResult(data.data);
            // emotions_summary JSONB olarak kaydet
            const emotionsSummary = data.data.scores
                ? Object.fromEntries(
                    Object.entries(data.data.scores).map(([k, v]) => [k, Math.round(v)])
                )
                : { [data.data.label]: 1 };
            saveJob('manual', 0, { total: 1, emotionsSummary });
        }
    };

    // ── Toplu analiz ──
    const handleBatchAnalyze = async () => {
        const lines = sharedText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) {
            setBatchError('Her satıra bir metin yazın.');
            return;
        }
        if (lines.length > 50) {
            setBatchError('En fazla 50 metin analiz edilebilir.');
            return;
        }
        setBatchError(null);
        setBatchResults(null);
        setBatchLoading(true);

        const { data, error } = await analyzeBatch(lines);
        setBatchLoading(false);

        if (error) {
            setBatchError(error);
        } else if (data?.data) {
            setBatchResults(data.data);

            // Duygu sayımı JSONB
            const emotionsSummary: Record<string, number> = {};
            for (const item of data.data) {
                emotionsSummary[item.label] = (emotionsSummary[item.label] ?? 0) + 1;
            }
            saveJob('batch', 0, { total: data.data.length, emotionsSummary });
        }
    };

    // ── YouTube analizi ──
    const handleYoutubeAnalyze = async () => {
        if (!ytUrl.trim()) {
            setYtError('Lütfen bir YouTube URL\'si girin.');
            return;
        }
        setYtError(null);
        setYtResult(null);
        setYtLoading(true);

        const max = Math.min(Math.max(parseInt(ytMaxComments) || 100, 1), 500);
        const { data, error } = await analyzeYoutube(ytUrl.trim(), max);
        setYtLoading(false);

        if (error) {
            setYtError(error);
        } else if (data) {
            setYtResult(data);
            // breakdown'dan emotions_summary oluştur
            const emotionsSummary: Record<string, number> = {};
            for (const [label, info] of Object.entries(data.summary.breakdown)) {
                emotionsSummary[label] = info.count;
            }
            saveJob('youtube', 0, {
                total: data.summary.total_analyzed,
                emotionsSummary,
                youtube_url: ytUrl.trim(),
                youtube_video_title: data.video_info?.title,
                youtube_video_id: data.video_info?.video_id,
                youtube_channel_name: data.video_info?.channel_title ?? data.video_info?.channel,
            });
        }
    };

    // ── Supabase kayıt ──
    const saveJob = async (
        type: string,
        _ms: number,
        counts: {
            total: number;
            emotionsSummary: Record<string, number>;
            youtube_url?: string;
            youtube_video_title?: string;
            youtube_video_id?: string;
            youtube_channel_name?: string;
        }
    ) => {
        if (!user) return;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('analysis_jobs') as any).insert({
                user_id: user.id,
                job_type: type,
                status: 'completed',
                total_analyzed: counts.total,
                emotions_summary: counts.emotionsSummary,   // JSONB — dinamik
                // Geriye dönük uyumluluk (eski model çalışıyorsa doldur)
                positive_count: counts.emotionsSummary['Olumlu'] ?? counts.emotionsSummary['joy'] ?? 0,
                negative_count: counts.emotionsSummary['Olumsuz'] ?? counts.emotionsSummary['anger'] ?? 0,
                neutral_count: counts.emotionsSummary['Nötr'] ?? counts.emotionsSummary['neutral'] ?? 0,
                youtube_url: counts.youtube_url ?? null,
                youtube_video_title: counts.youtube_video_title ?? null,
                youtube_video_id: counts.youtube_video_id ?? null,
                youtube_channel_name: counts.youtube_channel_name ?? null,
            });
        } catch {/* sessiz hata */ }
    };

    // ───────────────────────────────────────────────────────────────────────
    // RENDER
    // ───────────────────────────────────────────────────────────────────────
    return (
        <View style={s.root}>
            <LinearGradient
                colors={['#08080F', '#0D0A1C', '#080F1A']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
            />

            {/* Arka plan ışık efektleri */}
            <View style={s.glowTL} />
            <View style={s.glowBR} />

            {/* ── HEADER ── */}
            <View style={s.header}>
                <View style={s.headerLeft}>
                    <LinearGradient
                        colors={Brand.gradientPrimary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.headerLogo}
                    >
                        <Text style={s.headerLogoText}>✦</Text>
                    </LinearGradient>
                    <View>
                        <Text style={s.headerGreeting}>Hoş geldin 👋</Text>
                        <Text style={s.headerName} numberOfLines={1}>
                            {user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? 'Kullanıcı'}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity onPress={signOut} style={s.signOutBtn}>
                    <Text style={s.signOutText}>Çıkış</Text>
                </TouchableOpacity>
            </View>

            {/* ── İÇERİK ── */}
            <View style={s.content}>
                {activeTab === 'analyze' && (
                    <AnalyzeTab
                        batchMode={batchMode}
                        onToggleBatch={() => {
                            setBatchMode(p => !p);
                            setManualResult(null);
                            setBatchResults(null);
                            setManualError(null);
                            setBatchError(null);
                        }}
                        // Manuel
                        manualText={sharedText}
                        onManualTextChange={setSharedText}
                        manualLoading={manualLoading}
                        manualResult={manualResult}
                        manualError={manualError}
                        onManualAnalyze={handleManualAnalyze}
                        // Toplu — aynı metin, aynı state
                        batchText={sharedText}
                        onBatchTextChange={setSharedText}
                        batchLoading={batchLoading}
                        batchResults={batchResults}
                        batchError={batchError}
                        onBatchAnalyze={handleBatchAnalyze}
                    />
                )}

                {activeTab === 'youtube' && (
                    <YoutubeTab
                        url={ytUrl}
                        onUrlChange={setYtUrl}
                        maxComments={ytMaxComments}
                        onMaxCommentsChange={setYtMaxComments}
                        loading={ytLoading}
                        result={ytResult}
                        error={ytError}
                        onAnalyze={handleYoutubeAnalyze}
                    />
                )}

                {activeTab === 'history' && (
                    <HistoryTab
                        jobs={history}
                        loading={historyLoading}
                        onRefresh={loadHistory}
                    />
                )}

                {activeTab === 'live' && (
                    <LiveScreen />
                )}

                {activeTab === 'profile' && (
                    <ProfileTab user={user} onSignOut={signOut} />
                )}
            </View>

            {/* ── ALT SEKME ÇUBUĞU ── */}
            <View style={s.tabBar}>
                {(
                    [
                        { key: 'analyze', icon: '🔍', label: 'Analiz' },
                        { key: 'youtube', icon: '▶️', label: 'YouTube' },
                        { key: 'live', icon: '📡', label: 'Canlı' },
                        { key: 'history', icon: '📋', label: 'Geçmiş' },
                        { key: 'profile', icon: '👤', label: 'Profil' },
                    ] as { key: Tab; icon: string; label: string }[]
                ).map(tab => {
                    const active = activeTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setActiveTab(tab.key)}
                            style={s.tabItem}
                            activeOpacity={0.75}
                        >
                            <View style={[s.tabIconWrap, active && s.tabIconActive]}>
                                <Text style={s.tabIcon}>{tab.icon}</Text>
                            </View>
                            <Text style={[s.tabLabel, active && s.tabLabelActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYZE TAB
// ═══════════════════════════════════════════════════════════════════════════
interface AnalyzeTabProps {
    batchMode: boolean;
    onToggleBatch: () => void;
    manualText: string;
    onManualTextChange: (t: string) => void;
    manualLoading: boolean;
    manualResult: SingleAnalysisResult | null;
    manualError: string | null;
    onManualAnalyze: () => void;
    batchText: string;
    onBatchTextChange: (t: string) => void;
    batchLoading: boolean;
    batchResults: { text: string; label: string; confidence: number; scores?: Record<string, number> }[] | null;
    batchError: string | null;
    onBatchAnalyze: () => void;
}

function AnalyzeTab({
    batchMode, onToggleBatch,
    manualText, onManualTextChange, manualLoading, manualResult, manualError, onManualAnalyze,
    batchText, onBatchTextChange, batchLoading, batchResults, batchError, onBatchAnalyze,
}: AnalyzeTabProps) {
    return (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={at.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            {/* Başlık + Mod Seçici */}
            <View style={at.row}>
                <View>
                    <Text style={at.title}>Metin Analizi</Text>
                    <Text style={at.subtitle}>Duygu analizi yapın</Text>
                </View>
                <View style={at.modeSelector}>
                    <TouchableOpacity
                        onPress={() => !batchMode || onToggleBatch()}
                        style={[at.modePill, !batchMode && at.modePillActive]}
                        activeOpacity={0.8}
                    >
                        <Text style={[at.modePillText, !batchMode && at.modePillTextActive]}>Tekil</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => batchMode || onToggleBatch()}
                        style={[at.modePill, batchMode && at.modePillActive]}
                        activeOpacity={0.8}
                    >
                        <Text style={[at.modePillText, batchMode && at.modePillTextActive]}>Toplu</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {!batchMode ? (
                /* ── TEKİL ANALİZ ── */
                <View style={at.card}>
                    <Text style={at.cardLabel}>Analiz edilecek metin</Text>
                    <TextInput
                        style={at.textArea}
                        placeholder="Metninizi buraya yazın..."
                        placeholderTextColor="rgba(255,255,255,0.22)"
                        value={manualText}
                        onChangeText={onManualTextChange}
                        multiline
                        numberOfLines={5}
                        textAlignVertical="top"
                        selectionColor={Brand.primaryLight}
                    />
                    <Text style={at.charCount}>{manualText.length} / 512 karakter</Text>

                    {manualError && <ErrorBox msg={manualError} />}

                    <GradientButton
                        label="Analiz Et"
                        onPress={onManualAnalyze}
                        loading={manualLoading}
                    />

                    {manualResult && (
                        <SingleResultCard result={manualResult} />
                    )}
                </View>
            ) : (
                /* ── TOPLU ANALİZ ── */
                <View style={at.card}>
                    <Text style={at.cardLabel}>Metinler (her satır = 1 metin, maks 50)</Text>
                    <TextInput
                        style={[at.textArea, { minHeight: 140 }]}
                        placeholder={"Bu ürün çok güzel!\nKötü bir deneyim yaşadım.\nFiyatı uygun ama kalite orta."}
                        placeholderTextColor="rgba(255,255,255,0.22)"
                        value={batchText}
                        onChangeText={onBatchTextChange}
                        multiline
                        textAlignVertical="top"
                        selectionColor={Brand.primaryLight}
                    />

                    {batchError && <ErrorBox msg={batchError} />}

                    <GradientButton
                        label="Toplu Analiz Et"
                        onPress={onBatchAnalyze}
                        loading={batchLoading}
                    />

                    {batchResults && batchResults.length > 0 && (
                        <BatchResultsCard results={batchResults} />
                    )}
                </View>
            )}
        </ScrollView>
    );
}

const at = StyleSheet.create({
    scroll: { padding: 20, gap: 16, paddingBottom: 40 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 22, fontWeight: '700', color: '#fff' },
    subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
    modeSelector: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 10,
        padding: 3,
        gap: 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    modePill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8,
    },
    modePillActive: {
        backgroundColor: Brand.primary,
        shadowColor: Brand.primary,
        shadowOpacity: 0.5,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    modePillText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
    modePillTextActive: { color: '#ffffff' },
    card: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        padding: 18,
        gap: 14,
    },
    cardLabel: { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
    textArea: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        color: '#fff',
        fontSize: 15,
        padding: 14,
        minHeight: 110,
        lineHeight: 22,
    },
    charCount: { fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginTop: -6 },
});

// ═══════════════════════════════════════════════════════════════════════════
// YOUTUBE TAB
// ═══════════════════════════════════════════════════════════════════════════
interface YoutubeTabProps {
    url: string;
    onUrlChange: (u: string) => void;
    maxComments: string;
    onMaxCommentsChange: (v: string) => void;
    loading: boolean;
    result: YoutubeAnalysisResult | null;
    error: string | null;
    onAnalyze: () => void;
}

function YoutubeTab({ url, onUrlChange, maxComments, onMaxCommentsChange, loading, result, error, onAnalyze }: YoutubeTabProps) {
    return (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={yt.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            <Text style={yt.title}>YouTube Analizi</Text>
            <Text style={yt.subtitle}>Video yorumlarının duygu dağılımını analiz edin</Text>

            <View style={yt.card}>
                <Text style={yt.label}>YouTube Video URL</Text>
                <TextInput
                    style={yt.input}
                    placeholder="https://www.youtube.com/watch?v=..."
                    placeholderTextColor="rgba(255,255,255,0.22)"
                    value={url}
                    onChangeText={onUrlChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    selectionColor={Brand.primaryLight}
                />

                <Text style={yt.label}>Maksimum Yorum Sayısı</Text>
                <View style={yt.sliderRow}>
                    {['50', '100', '200', '500'].map(v => (
                        <TouchableOpacity
                            key={v}
                            onPress={() => onMaxCommentsChange(v)}
                            style={[yt.chip, maxComments === v && yt.chipActive]}
                        >
                            <Text style={[yt.chipText, maxComments === v && yt.chipTextActive]}>{v}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {error && <ErrorBox msg={error} />}

                <GradientButton label="Yorumları Analiz Et" onPress={onAnalyze} loading={loading} />

                {loading && (
                    <View style={yt.loadingInfo}>
                        <ActivityIndicator color={Brand.primaryLight} size="small" />
                        <Text style={yt.loadingText}>Yorumlar çekiliyor ve analiz ediliyor...</Text>
                    </View>
                )}
            </View>

            {result && <YoutubeResultCard result={result} />}
        </ScrollView>
    );
}

const yt = StyleSheet.create({
    scroll: { padding: 20, gap: 16, paddingBottom: 40 },
    title: { fontSize: 22, fontWeight: '700', color: '#fff' },
    subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
    card: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        padding: 18,
        gap: 12,
    },
    label: { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        color: '#fff',
        fontSize: 14,
        paddingHorizontal: 14,
        paddingVertical: 13,
    },
    sliderRow: { flexDirection: 'row', gap: 8 },
    chip: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    chipActive: {
        backgroundColor: 'rgba(124,58,237,0.2)',
        borderColor: Brand.primary,
    },
    chipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: Brand.primaryLight },
    loadingInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 8 },
    loadingText: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
});

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY TAB
// ═══════════════════════════════════════════════════════════════════════════
function HistoryTab({ jobs, loading, onRefresh }: { jobs: (HistoryJob | LiveHistoryJob)[]; loading: boolean; onRefresh: () => void }) {
    const typeLabel: Record<string, string> = {
        manual: '📝 Metin',
        batch: '📄 Toplu',
        youtube: '▶️ YouTube',
        ecommerce: '🛒️ E-Ticaret',
        gmaps: '📍 Harita',
    };

    if (loading) {
        return (
            <View style={hist.center}>
                <ActivityIndicator color={Brand.primaryLight} size="large" />
                <Text style={hist.emptyText}>Geçmiş yükleniyor...</Text>
            </View>
        );
    }

    if (jobs.length === 0) {
        return (
            <View style={hist.center}>
                <Text style={{ fontSize: 40 }}>📊</Text>
                <Text style={hist.emptyTitle}>Henüz analiz yok</Text>
                <Text style={hist.emptyText}>İlk analizinizi yapın!</Text>
                <TouchableOpacity onPress={onRefresh} style={hist.refreshBtn}>
                    <Text style={hist.refreshText}>Yenile</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <View style={hist.headerRow}>
                <Text style={hist.title}>Analiz Geçmişi</Text>
                <TouchableOpacity onPress={onRefresh} style={hist.refreshBtn}>
                    <Text style={hist.refreshText}>↺ Yenile</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={jobs}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                    // ── CANLI YAYIN KARTI ──
                    if (item._source === 'live') {
                        const liveItem = item as LiveHistoryJob;
                        const timeline = liveItem.emotions_timeline ?? [];
                        const peakMeta = liveItem.peak_emotion ? getEmotionMeta(liveItem.peak_emotion) : null;
                        const durationStr = liveItem.duration_secs
                            ? liveItem.duration_secs >= 60
                                ? `${Math.floor(liveItem.duration_secs / 60)}dk ${liveItem.duration_secs % 60}sn`
                                : `${liveItem.duration_secs}sn`
                            : '—';

                        return (
                            <View style={[hist.card, hist.liveCard]}>
                                <View style={hist.cardTop}>
                                    <View style={hist.liveBadgeWrap}>
                                        <View style={hist.liveDot} />
                                        <Text style={hist.liveTag}>📡 YouTube Live</Text>
                                    </View>
                                    <Text style={hist.date}>
                                        {new Date(liveItem.created_at).toLocaleDateString('tr-TR', {
                                            day: '2-digit', month: 'short', year: 'numeric',
                                        })}
                                    </Text>
                                </View>

                                {liveItem.video_title && (
                                    <Text style={hist.videoTitle} numberOfLines={2}>
                                        {liveItem.video_title}
                                    </Text>
                                )}
                                {liveItem.channel_name && (
                                    <Text style={hist.channelName}>📺 {liveItem.channel_name}</Text>
                                )}

                                <View style={hist.liveStats}>
                                    <View style={hist.liveStatItem}>
                                        <Text style={hist.liveStatValue}>{liveItem.total_messages.toLocaleString('tr-TR')}</Text>
                                        <Text style={hist.liveStatLabel}>Mesaj</Text>
                                    </View>
                                    <View style={hist.liveStatDivider} />
                                    <View style={hist.liveStatItem}>
                                        <Text style={hist.liveStatValue}>{liveItem.total_buckets}</Text>
                                        <Text style={hist.liveStatLabel}>Veri Noktası</Text>
                                    </View>
                                    <View style={hist.liveStatDivider} />
                                    <View style={hist.liveStatItem}>
                                        <Text style={hist.liveStatValue}>{durationStr}</Text>
                                        <Text style={hist.liveStatLabel}>Süre</Text>
                                    </View>
                                    {peakMeta && (
                                        <>
                                            <View style={hist.liveStatDivider} />
                                            <View style={hist.liveStatItem}>
                                                <Text style={[hist.liveStatValue, { color: peakMeta.color }]}>
                                                    {peakMeta.emoji}
                                                </Text>
                                                <Text style={[hist.liveStatLabel, { color: peakMeta.color }]}>
                                                    {peakMeta.label}
                                                </Text>
                                            </View>
                                        </>
                                    )}
                                </View>

                                {/* Duygu zaman serisi grafiği */}
                                {timeline.length > 0 && (
                                    <View style={hist.chartWrap}>
                                        <Text style={hist.chartLabel}>Duygu Zaman Serisi</Text>
                                        <EmotionLineChart
                                            dataPoints={timeline}
                                            height={160}
                                        />
                                    </View>
                                )}
                            </View>
                        );
                    }

                    // ── NORMAL ANALİZ KARTI ──
                    const jobItem = item as HistoryJob;
                    const total = jobItem.total_analyzed || 1;
                    const emotionEntries = jobItem.emotions_summary
                        ? Object.entries(jobItem.emotions_summary)
                        : [
                            ['Olumlu', jobItem.positive_count],
                            ['Olumsuz', jobItem.negative_count],
                            ['Nötr', jobItem.neutral_count],
                        ] as [string, number][];

                    return (
                        <View style={hist.card}>
                            <View style={hist.cardTop}>
                                <Text style={hist.typeTag}>{typeLabel[jobItem.job_type] ?? jobItem.job_type}</Text>
                                <Text style={hist.date}>
                                    {new Date(jobItem.created_at).toLocaleDateString('tr-TR', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                    })}
                                </Text>
                            </View>

                            {jobItem.youtube_video_title && (
                                <Text style={hist.videoTitle} numberOfLines={2}>
                                    {jobItem.youtube_video_title}
                                </Text>
                            )}

                            <Text style={hist.totalText}>
                                {jobItem.job_type === 'manual' ? '1 metin' : `${jobItem.total_analyzed} metin`} analiz edildi
                            </Text>

                            <View style={hist.barsWrap}>
                                {emotionEntries.map(([label, count]) => {
                                    const meta = getEmotionMeta(label);
                                    return (
                                        <EmotionBar
                                            key={label}
                                            label={meta.label}
                                            count={count as number}
                                            total={total}
                                            color={meta.color}
                                        />
                                    );
                                })}
                            </View>
                        </View>
                    );
                }}
            />
        </View>
    );
}



const hist = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    title: { fontSize: 20, fontWeight: '700', color: '#fff' },
    refreshBtn: {
        backgroundColor: 'rgba(124,58,237,0.15)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(124,58,237,0.3)',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    refreshText: { color: Brand.primaryLight, fontSize: 13, fontWeight: '600' },
    card: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        padding: 16,
        gap: 10,
    },
    // ── Canlı yayın kartı ──
    liveCard: {
        borderColor: 'rgba(239,68,68,0.25)',
        backgroundColor: 'rgba(239,68,68,0.04)',
    },
    liveBadgeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444' },
    liveTag: { fontSize: 13, color: '#EF4444', fontWeight: '700' },
    channelName: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: -4 },
    liveStats: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 6,
    },
    liveStatItem: { flex: 1, alignItems: 'center', gap: 2 },
    liveStatValue: { fontSize: 15, fontWeight: '800', color: '#fff' },
    liveStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
    liveStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },
    chartWrap: { gap: 8 },
    chartLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
    // ── Normal analiz kartı ──
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    typeTag: { fontSize: 13, color: Brand.primaryLight, fontWeight: '600' },
    date: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
    videoTitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18, fontWeight: '600' },
    totalText: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
    barsWrap: { gap: 8 },
});

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE TAB
// ═══════════════════════════════════════════════════════════════════════════
function ProfileTab({ user, onSignOut }: { user: any; onSignOut: () => void }) {
    return (
        <ScrollView contentContainerStyle={prof.scroll} showsVerticalScrollIndicator={false}>
            {/* Avatar */}
            <View style={prof.avatarWrap}>
                <LinearGradient
                    colors={Brand.gradientPrimary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={prof.avatar}
                >
                    <Text style={prof.avatarText}>
                        {(user?.user_metadata?.display_name ?? user?.email ?? 'U')[0].toUpperCase()}
                    </Text>
                </LinearGradient>
                <Text style={prof.name}>
                    {user?.user_metadata?.display_name ?? user?.email?.split('@')[0]}
                </Text>
                <Text style={prof.email}>{user?.email}</Text>
            </View>

            {/* Bilgi kartı */}
            <View style={prof.card}>
                <Text style={prof.cardTitle}>Hesap Bilgileri</Text>
                <View style={prof.row}>
                    <Text style={prof.rowKey}>Üyelik tarihi</Text>
                    <Text style={prof.rowVal}>
                        {user?.created_at
                            ? new Date(user.created_at).toLocaleDateString('tr-TR', {
                                day: '2-digit', month: 'long', year: 'numeric',
                            })
                            : '—'}
                    </Text>
                </View>
                <View style={prof.divider} />
                <View style={prof.row}>
                    <Text style={prof.rowKey}>Giriş yöntemi</Text>
                    <Text style={prof.rowVal}>
                        {user?.app_metadata?.provider === 'google' ? '🔑 Google' : '📧 Email'}
                    </Text>
                </View>
            </View>

            {/* Çıkış */}
            <TouchableOpacity
                onPress={() =>
                    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkmak istiyor musunuz?', [
                        { text: 'İptal', style: 'cancel' },
                        { text: 'Çıkış', style: 'destructive', onPress: onSignOut },
                    ])
                }
                style={prof.signOutBtn}
                activeOpacity={0.8}
            >
                <Text style={prof.signOutText}>🚪 Çıkış Yap</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const prof = StyleSheet.create({
    scroll: { padding: 24, gap: 20, alignItems: 'center', paddingBottom: 60 },
    avatarWrap: { alignItems: 'center', gap: 10, marginTop: 16 },
    avatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Brand.primary,
        shadowOpacity: 0.5,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    avatarText: { fontSize: 36, color: '#fff', fontWeight: '700' },
    name: { fontSize: 20, fontWeight: '700', color: '#fff' },
    email: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
    card: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        padding: 18,
        gap: 14,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    rowKey: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
    rowVal: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
    signOutBtn: {
        width: '100%',
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.25)',
        paddingVertical: 16,
        alignItems: 'center',
    },
    signOutText: { color: '#FCA5A5', fontSize: 15, fontWeight: '600' },
});

// ═══════════════════════════════════════════════════════════════════════════
// SHARED SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function ErrorBox({ msg }: { msg: string }) {
    return (
        <View style={shared.errorBox}>
            <Text style={shared.errorText}>⚠ {msg}</Text>
        </View>
    );
}

function GradientButton({ label, onPress, loading }: { label: string; onPress: () => void; loading: boolean }) {
    return (
        <TouchableOpacity onPress={onPress} disabled={loading} activeOpacity={0.85} style={shared.btnWrap}>
            <LinearGradient
                colors={Brand.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={shared.btn}
            >
                {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={shared.btnText}>{label}</Text>
                }
            </LinearGradient>
        </TouchableOpacity>
    );
}

/**
 * Tekil analiz sonuç kartı — dinamik duygu etiketi
 */
function SingleResultCard({ result }: { result: SingleAnalysisResult }) {
    const meta = getEmotionMeta(result.label);

    return (
        <View style={[shared.resultCard, { borderColor: meta.color + '40', backgroundColor: meta.bg }]}>
            <View style={shared.resultTop}>
                <Text style={shared.resultEmoji}>{meta.emoji}</Text>
                <View style={{ flex: 1 }}>
                    <Text style={[shared.resultLabel, { color: meta.color }]}>{meta.label}</Text>
                    <Text style={shared.resultConf}>%{result.confidence.toFixed(1)} güven</Text>
                </View>
                <Text style={shared.resultTime}>{result.process_time_ms}ms</Text>
            </View>

            {/* Güven çubuğu */}
            <View style={shared.confTrack}>
                <View
                    style={[
                        shared.confFill,
                        { width: `${result.confidence}%` as any, backgroundColor: meta.color },
                    ]}
                />
            </View>

            {/* Çoklu duygu skoru varsa mini çubuk listesi */}
            {result.scores && Object.keys(result.scores).length > 1 && (
                <View style={shared.scoresWrap}>
                    <Text style={shared.scoresTitle}>Duygu Dağılımı</Text>
                    {Object.entries(result.scores)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([lbl, pct]) => {
                            const sm = getEmotionMeta(lbl);
                            return (
                                <EmotionBar
                                    key={lbl}
                                    label={sm.label}
                                    count={Math.round(pct)}
                                    total={100}
                                    color={sm.color}
                                />
                            );
                        })}
                </View>
            )}
        </View>
    );
}

/**
 * Toplu analiz sonuç kartı — dinamik duygu etiketleri
 */
function BatchResultsCard({ results }: { results: { text: string; label: string; confidence: number; scores?: Record<string, number> }[] }) {
    const total = results.length;

    // Duygu sayımı — herhangi etiket için
    const counts: Record<string, number> = {};
    for (const r of results) {
        counts[r.label] = (counts[r.label] ?? 0) + 1;
    }

    return (
        <View style={shared.batchCard}>
            <Text style={shared.batchTitle}>Toplu Analiz Sonuçları ({total} metin)</Text>

            <View style={shared.barsWrap}>
                {Object.entries(counts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([label, count]) => {
                        const meta = getEmotionMeta(label);
                        return (
                            <EmotionBar
                                key={label}
                                label={meta.label}
                                count={count}
                                total={total}
                                color={meta.color}
                            />
                        );
                    })}
            </View>

            <View style={shared.itemList}>
                {results.map((r, i) => {
                    const meta = getEmotionMeta(r.label);
                    return (
                        <View key={i} style={shared.batchItem}>
                            <View style={[shared.batchDot, { backgroundColor: meta.color }]} />
                            <Text style={shared.batchItemText} numberOfLines={1}>{r.text}</Text>
                            <Text style={[shared.batchItemLabel, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

/**
 * YouTube analiz sonuç kartı — dinamik duygu dağılımı
 */
function YoutubeResultCard({ result }: { result: YoutubeAnalysisResult }) {
    const s = result.summary;
    const total = s.total_analyzed || 1;

    // breakdown'daki tüm etiketleri sayıca sırala
    const sortedBreakdown = Object.entries(s.breakdown)
        .sort(([, a], [, b]) => b.count - a.count);

    // İlk 3'ü CircleProgress için al
    const top3 = sortedBreakdown.slice(0, 3);

    return (
        <View style={ytRes.wrap}>
            {/* Video bilgisi */}
            <LinearGradient
                colors={Brand.gradientCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={ytRes.videoCard}
            >
                <Text style={ytRes.videoTitle} numberOfLines={2}>{result.video_info?.title}</Text>
                <Text style={ytRes.channelName}>📺 {result.video_info?.channel_title ?? result.video_info?.channel}</Text>
                <View style={ytRes.statsRow}>
                    <Text style={ytRes.stat}>👁 {parseInt(result.video_info?.view_count ?? '0').toLocaleString('tr-TR')}</Text>
                    <Text style={ytRes.stat}>💬 {s.total_fetched} yorum çekildi</Text>
                    <Text style={ytRes.stat}>✅ {s.total_analyzed} analiz edildi</Text>
                </View>
            </LinearGradient>

            {/* Dağılım kartı — dinamik */}
            <View style={ytRes.breakCard}>
                <Text style={ytRes.sectionTitle}>Duygu Dağılımı</Text>

                {/* En baskın 3 duygu için CircleProgress */}
                {top3.length > 0 && (
                    <View style={ytRes.circleRow}>
                        {top3.map(([label, info]) => {
                            const meta = getEmotionMeta(label);
                            return (
                                <CircleProgress
                                    key={label}
                                    value={info.percentage}
                                    color={meta.color}
                                    label={meta.label}
                                />
                            );
                        })}
                    </View>
                )}

                {/* Tüm duygular için bar listesi */}
                <View style={{ gap: 8 }}>
                    {sortedBreakdown.map(([label, info]) => {
                        const meta = getEmotionMeta(label);
                        return (
                            <EmotionBar
                                key={label}
                                label={meta.label}
                                count={info.count}
                                total={total}
                                color={meta.color}
                            />
                        );
                    })}
                </View>
            </View>

            {/* Yorum listesi */}
            {result.data && result.data.length > 0 && (
                <View style={ytRes.commentSection}>
                    <Text style={ytRes.sectionTitle}>Yorumlar ({result.data.length})</Text>
                    {result.data.slice(0, 20).map((c, i) => {
                        const meta = getEmotionMeta(c.label);
                        return (
                            <View key={i} style={ytRes.commentCard}>
                                <View style={ytRes.commentTop}>
                                    <Text style={ytRes.commentAuthor}>@{c.author}</Text>
                                    <View style={[ytRes.labelBadge, { backgroundColor: meta.color + '22' }]}>
                                        <Text style={[ytRes.labelBadgeText, { color: meta.color }]}>
                                            {meta.emoji} {meta.label}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={ytRes.commentText} numberOfLines={3}>{c.text}</Text>
                                <Text style={ytRes.commentConf}>%{c.confidence.toFixed(0)} güven</Text>
                            </View>
                        );
                    })}
                    {result.data.length > 20 && (
                        <Text style={ytRes.moreText}>+{result.data.length - 20} yorum daha...</Text>
                    )}
                </View>
            )}
        </View>
    );
}

const ytRes = StyleSheet.create({
    wrap: { gap: 14 },
    videoCard: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(124,58,237,0.2)',
        padding: 18,
        gap: 8,
    },
    videoTitle: { fontSize: 15, fontWeight: '700', color: '#fff', lineHeight: 20 },
    channelName: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
    statsRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginTop: 4 },
    stat: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
    breakCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        padding: 18,
        gap: 16,
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
    circleRow: { flexDirection: 'row', justifyContent: 'space-around' },
    commentSection: { gap: 10 },
    commentCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        padding: 14,
        gap: 6,
    },
    commentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    commentAuthor: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
    labelBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    labelBadgeText: { fontSize: 11, fontWeight: '700' },
    commentText: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18 },
    commentConf: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
    moreText: { textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13, paddingVertical: 8 },
});

const shared = StyleSheet.create({
    errorBox: {
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.25)',
        padding: 12,
    },
    errorText: { color: '#FCA5A5', fontSize: 13 },
    btnWrap: {
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: Brand.primary,
        shadowOpacity: 0.45,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    btn: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
    resultCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 18,
        gap: 12,
    },
    resultTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    resultEmoji: { fontSize: 32 },
    resultLabel: { fontSize: 20, fontWeight: '800' },
    resultConf: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
    resultTime: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
    confTrack: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    confFill: { height: '100%', borderRadius: 4 },
    scoresWrap: { gap: 8, marginTop: 4 },
    scoresTitle: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '500', marginBottom: 4 },
    batchCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        padding: 16,
        gap: 14,
    },
    batchTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
    barsWrap: { gap: 8 },
    itemList: { gap: 6 },
    batchItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    batchDot: { width: 8, height: 8, borderRadius: 4 },
    batchItemText: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.65)' },
    batchItemLabel: { fontSize: 12, fontWeight: '600' },
});

// ─── Ana ekran stilleri ────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#08080F' },
    glowTL: {
        position: 'absolute', top: -100, left: -100,
        width: 320, height: 320, borderRadius: 160,
        backgroundColor: 'rgba(124,58,237,0.12)',
    },
    glowBR: {
        position: 'absolute', bottom: -80, right: -80,
        width: 260, height: 260, borderRadius: 130,
        backgroundColor: 'rgba(37,99,235,0.1)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 48,
        paddingBottom: 16,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerLogo: {
        width: 40, height: 40, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    headerLogoText: { fontSize: 18, color: '#fff' },
    headerGreeting: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
    headerName: { fontSize: 16, fontWeight: '700', color: '#fff', maxWidth: SCREEN_W * 0.45 },
    signOutBtn: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    signOutText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '500' },
    content: { flex: 1, overflow: 'hidden' },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.07)',
        paddingBottom: Platform.OS === 'ios' ? 24 : 10,
        paddingTop: 10,
    },
    tabItem: { flex: 1, alignItems: 'center', gap: 4 },
    tabIconWrap: {
        width: 40, height: 28,
        alignItems: 'center', justifyContent: 'center',
        borderRadius: 12,
    },
    tabIconActive: { backgroundColor: 'rgba(124,58,237,0.2)' },
    tabIcon: { fontSize: 16 },
    tabLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
    tabLabelActive: { color: Brand.primaryLight, fontWeight: '700' },
});
