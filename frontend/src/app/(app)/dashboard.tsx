/**
 * dashboard.tsx — Sentilyze Ana Ekranı (Premium Modern UI)
 *
 * 5 sekme: Analiz / YouTube / Canlı / Geçmiş / Profil
 * Yeni: ModernTabBar, GlassCard, ProgressRing, AnimatedBar, MeshBackground
 */

import { useState, useEffect, useCallback } from 'react';
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
import Animated, {
    useSharedValue,
    withSpring,
    useAnimatedStyle,
    FadeIn,
    FadeInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/use-auth';
import { useApi, type SingleAnalysisResult, type YoutubeAnalysisResult } from '@/hooks/use-api';
import { Brand, getEmotionMeta, UI, Spring, Fonts } from '@/constants/theme';
import { apiGet, apiPost } from '@/lib/api-client';
import LiveScreen from '@/app/(app)/live';
import EmotionLineChart from '@/components/EmotionLineChart';

import MeshBackground from '@/components/ui/MeshBackground';
import GlassCard from '@/components/ui/GlassCard';
import ModernTabBar, { type TabKey } from '@/components/ui/ModernTabBar';
import SpringButton from '@/components/ui/SpringButton';
import ProgressRing from '@/components/ui/ProgressRing';
import AnimatedBar from '@/components/ui/AnimatedBar';
import ShimmerLoader from '@/components/ui/ShimmerLoader';
import SentilyzeIcon from '@/components/ui/SentilyzeIcon';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Tip Tanımları ─────────────────────────────────────────────────────────
interface AnalyzedItem {
    analyzed_text: string;
    sentiment_label: string;
    confidence_score: number;
    emotion_scores: Record<string, number>;
    youtube_author?: string;
    youtube_like_count?: number;
}

interface HistoryJob {
    id: string;
    job_type: string;
    youtube_video_title: string | null;
    total_analyzed: number;
    emotions_summary: Record<string, number> | null;
    positive_count: number;
    negative_count: number;
    neutral_count: number;
    created_at: string;
    analyzed_items: AnalyzedItem[] | null;
    _source: 'job';
}

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

// ─── Ana Bileşen ────────────────────────────────────────────────────────────
export default function DashboardScreen() {
    const { user, signOut } = useAuth();
    const { analyzeSingle, analyzeBatch, analyzeYoutube } = useApi();

    const [activeTab, setActiveTab] = useState<TabKey>('analyze');

    // Analiz state
    const [sharedText,    setSharedText]    = useState('');
    const [manualLoading, setManualLoading] = useState(false);
    const [manualResult,  setManualResult]  = useState<SingleAnalysisResult | null>(null);
    const [manualError,   setManualError]   = useState<string | null>(null);

    // Toplu analiz state
    const [batchMode,    setBatchMode]    = useState(false);
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchResults, setBatchResults] = useState<{ text: string; label: string; confidence: number; scores?: Record<string, number> }[] | null>(null);
    const [batchError,   setBatchError]   = useState<string | null>(null);

    // YouTube state
    const [ytUrl,         setYtUrl]         = useState('');
    const [ytMaxComments, setYtMaxComments] = useState('100');
    const [ytLoading,     setYtLoading]     = useState(false);
    const [ytResult,      setYtResult]      = useState<YoutubeAnalysisResult | null>(null);
    const [ytError,       setYtError]       = useState<string | null>(null);

    // Geçmiş state
    const [history,        setHistory]        = useState<(HistoryJob | LiveHistoryJob)[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);

        const { data: jobsRes } = await apiGet<{
            data: Array<{
                id: number;
                job_type: string;
                job_status: string;
                total_analyzed: number;
                emotions_summary: Record<string, number> | null;
                positive_count: number;
                negative_count: number;
                neutral_count: number;
                youtube_video_title: string | null;
                analyzed_items: AnalyzedItem[] | null;
                createdAt: string;
            }>;
        }>('/api/analysis-jobs?sort=createdAt:desc&pagination[limit]=20');

        const { data: liveRes } = await apiGet<{
            data: Array<{
                id: number;
                platform: string;
                video_id: string | null;
                video_title: string | null;
                channel_name: string | null;
                total_messages: number;
                total_buckets: number;
                peak_emotion: string | null;
                duration_secs: number | null;
                emotions_timeline: LiveHistoryJob['emotions_timeline'];
                createdAt: string;
            }>;
        }>('/api/live-sessions?sort=createdAt:desc&pagination[limit]=10');

        const jobItems: HistoryJob[] = (jobsRes?.data ?? []).map((j) => ({
            id: String(j.id),
            job_type: j.job_type,
            youtube_video_title: j.youtube_video_title ?? null,
            total_analyzed: j.total_analyzed,
            emotions_summary: j.emotions_summary ?? null,
            positive_count: j.positive_count,
            negative_count: j.negative_count,
            neutral_count:  j.neutral_count,
            created_at:     j.createdAt,
            analyzed_items: j.analyzed_items ?? null,
            _source:        'job' as const,
        }));
        const liveItems: LiveHistoryJob[] = (liveRes?.data ?? []).map((l) => ({
            id:                String(l.id),
            platform:          l.platform,
            video_id:          l.video_id ?? null,
            video_title:       l.video_title ?? null,
            channel_name:      l.channel_name ?? null,
            total_messages:    l.total_messages,
            total_buckets:     l.total_buckets,
            peak_emotion:      l.peak_emotion ?? null,
            duration_secs:     l.duration_secs ?? null,
            emotions_timeline: l.emotions_timeline ?? null,
            created_at:        l.createdAt,
            _source:           'live' as const,
        }));

        const merged = [...jobItems, ...liveItems].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        setHistoryLoading(false);
        setHistory(merged);
    }, []);

    // Geçmiş sekmesine her geçişte otomatik yükle
    useEffect(() => {
        if (activeTab === 'history') loadHistory();
    }, [activeTab]);
    const handleManualAnalyze = async () => {
        if (!sharedText.trim()) { setManualError('Lütfen analiz edilecek metni girin.'); return; }
        setManualError(null); setManualResult(null); setManualLoading(true);
        const { data, error } = await analyzeSingle(sharedText.trim());
        setManualLoading(false);
        if (error) {
            setManualError(error);
        } else if (data?.data) {
            setManualResult(data.data);
            const emotionsSummary = data.data.scores
                ? Object.fromEntries(Object.entries(data.data.scores).map(([k, v]) => [k, Math.round(v)]))
                : { [data.data.label]: 1 };
            saveJob('manual', 0, {
                total: 1,
                emotionsSummary,
                analyzedItems: [{
                    analyzed_text:    data.data.text,
                    sentiment_label:  data.data.label,
                    confidence_score: data.data.confidence,
                    emotion_scores:   data.data.scores ?? {},
                }],
            });
        }
    };

    const handleBatchAnalyze = async () => {
        const lines = sharedText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) { setBatchError('Her satıra bir metin yazın.'); return; }
        if (lines.length > 50)  { setBatchError('En fazla 50 metin analiz edilebilir.'); return; }
        setBatchError(null); setBatchResults(null); setBatchLoading(true);
        const { data, error } = await analyzeBatch(lines);
        setBatchLoading(false);
        if (error) {
            setBatchError(error);
        } else if (data?.data) {
            setBatchResults(data.data);
            const emotionsSummary: Record<string, number> = {};
            for (const item of data.data) {
                emotionsSummary[item.label] = (emotionsSummary[item.label] ?? 0) + 1;
            }
            saveJob('batch', 0, {
                total: data.data.length,
                emotionsSummary,
                analyzedItems: data.data.map(item => ({
                    analyzed_text:    item.text,
                    sentiment_label:  item.label,
                    confidence_score: item.confidence,
                    emotion_scores:   item.scores ?? {},
                })),
            });
        }
    };

    const handleYoutubeAnalyze = async () => {
        if (!ytUrl.trim()) { setYtError("Lütfen bir YouTube URL'si girin."); return; }
        setYtError(null); setYtResult(null); setYtLoading(true);
        const max = Math.min(Math.max(parseInt(ytMaxComments) || 100, 1), 500);
        const { data, error } = await analyzeYoutube(ytUrl.trim(), max);
        setYtLoading(false);
        if (error) {
            setYtError(error);
        } else if (data) {
            setYtResult(data);
            const emotionsSummary: Record<string, number> = {};
            for (const [label, info] of Object.entries(data.summary.breakdown)) {
                emotionsSummary[label] = info.count;
            }
            saveJob('youtube', 0, {
                total: data.summary.total_analyzed,
                emotionsSummary,
                youtube_url: ytUrl.trim(),
                youtube_video_title: data.video_info?.title,
                youtube_video_id:    data.video_info?.video_id,
                youtube_channel_name: data.video_info?.channel_title ?? data.video_info?.channel,
                analyzedItems: (data.data ?? []).map(item => ({
                    analyzed_text:      item.text,
                    sentiment_label:    item.label,
                    confidence_score:   item.confidence,
                    emotion_scores:     item.scores ?? {},
                    youtube_author:     item.author,
                    youtube_like_count: item.like_count,
                })),
            });
        }
    };

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
            analyzedItems?: AnalyzedItem[];
        },
    ) => {
        if (!user) return;
        try {
            const { error } = await apiPost('/api/analysis-jobs', {
                data: {
                    job_type:             type,
                    job_status:           'completed',
                    total_analyzed:       counts.total,
                    emotions_summary:     counts.emotionsSummary,
                    positive_count:  counts.emotionsSummary['Olumlu'] ?? counts.emotionsSummary['joy'] ?? 0,
                    negative_count:  counts.emotionsSummary['Olumsuz'] ?? counts.emotionsSummary['anger'] ?? 0,
                    neutral_count:   counts.emotionsSummary['Nötr'] ?? counts.emotionsSummary['neutral'] ?? 0,
                    youtube_url:          counts.youtube_url ?? null,
                    youtube_video_title:  counts.youtube_video_title ?? null,
                    youtube_video_id:     counts.youtube_video_id ?? null,
                    youtube_channel_name: counts.youtube_channel_name ?? null,
                    // En fazla 100 yorum sakla (boyutu sınırlamak için)
                    analyzed_items: counts.analyzedItems?.slice(0, 100) ?? [],
                },
            });
            if (error) {
                console.warn('[saveJob] Strapi kayıt hatası:', error);
            } else if (activeTab === 'history') {
                // Geçmiş zaten açıksa yenile
                loadHistory();
            }
        } catch (e) {
            console.warn('[saveJob] Beklenmeyen hata:', e);
        }
    };

    return (
        <View style={s.root}>
            {/* Animasyonlu mesh gradient arka plan */}
            <MeshBackground />

            {/* ── HEADER ── */}
            <View style={s.header}>
                <View style={s.headerLeft}>
                    <View style={s.logoWrap}>
                        <LinearGradient
                            colors={Brand.gradientPrimary}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={s.headerLogo}
                        >
                            <SentilyzeIcon size={22} color1="#fff" color2="rgba(255,255,255,0.8)" />
                        </LinearGradient>
                    </View>
                    <View>
                        <Text style={s.headerGreeting}>Hoş geldin</Text>
                        <Text style={s.headerName} numberOfLines={1}>
                            {user?.username ?? user?.email?.split('@')[0] ?? 'Kullanıcı'}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity onPress={signOut} style={s.signOutBtn} activeOpacity={0.75}>
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
                            setManualResult(null); setBatchResults(null);
                            setManualError(null);  setBatchError(null);
                        }}
                        manualText={sharedText}      onManualTextChange={setSharedText}
                        manualLoading={manualLoading} manualResult={manualResult}
                        manualError={manualError}     onManualAnalyze={handleManualAnalyze}
                        batchText={sharedText}        onBatchTextChange={setSharedText}
                        batchLoading={batchLoading}   batchResults={batchResults}
                        batchError={batchError}       onBatchAnalyze={handleBatchAnalyze}
                    />
                )}
                {activeTab === 'youtube' && (
                    <YoutubeTab
                        url={ytUrl}               onUrlChange={setYtUrl}
                        maxComments={ytMaxComments} onMaxCommentsChange={setYtMaxComments}
                        loading={ytLoading}        result={ytResult}
                        error={ytError}            onAnalyze={handleYoutubeAnalyze}
                    />
                )}
                {activeTab === 'history' && (
                    <HistoryTab jobs={history} loading={historyLoading} onRefresh={loadHistory} />
                )}
                {activeTab === 'live' && <LiveScreen />}
                {activeTab === 'profile' && <ProfileTab user={user} onSignOut={signOut} />}
            </View>

            {/* ── YENİ TAB BAR ── */}
            <ModernTabBar activeTab={activeTab} onTabChange={setActiveTab} />
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYZE TAB
// ═══════════════════════════════════════════════════════════════════════════
interface AnalyzeTabProps {
    batchMode: boolean; onToggleBatch: () => void;
    manualText: string;      onManualTextChange: (t: string) => void;
    manualLoading: boolean;  manualResult: SingleAnalysisResult | null;
    manualError: string | null; onManualAnalyze: () => void;
    batchText: string;       onBatchTextChange: (t: string) => void;
    batchLoading: boolean;   batchResults: { text: string; label: string; confidence: number; scores?: Record<string, number> }[] | null;
    batchError: string | null; onBatchAnalyze: () => void;
}

function AnalyzeTab({
    batchMode, onToggleBatch,
    manualText, onManualTextChange, manualLoading, manualResult, manualError, onManualAnalyze,
    batchText, onBatchTextChange, batchLoading, batchResults, batchError, onBatchAnalyze,
}: AnalyzeTabProps) {
    // Animated sliding pill for Tekil/Toplu toggle
    const PILL_W = 60;
    const pillX  = useSharedValue(0);

    const pillStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: pillX.value }],
    }));

    const handleToggle = (wantBatch: boolean) => {
        if (wantBatch === batchMode) return;
        pillX.value = withSpring(wantBatch ? PILL_W + 2 : 0, Spring.tabPill);
        onToggleBatch();
    };

    return (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={at.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            <View style={at.row}>
                <View>
                    <Text style={at.title}>Metin Analizi</Text>
                    <Text style={at.subtitle}>Duygu analizi yapın</Text>
                </View>
                {/* Animated mode toggle */}
                <View style={at.modeSelector}>
                    <Animated.View style={[at.modeSlidingPill, pillStyle]} />
                    {(['Tekil', 'Toplu'] as const).map((label, i) => {
                        const active = i === 0 ? !batchMode : batchMode;
                        return (
                            <TouchableOpacity
                                key={label}
                                onPress={() => handleToggle(i === 1)}
                                style={at.modePill}
                                activeOpacity={0.8}
                            >
                                <Text style={[at.modePillText, active && at.modePillTextActive]}>{label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {!batchMode ? (
                <GlassCard variant="default" style={{ gap: 0 }} noPadding>
                    <View style={{ padding: 18, gap: 14 }}>
                        <Text style={at.cardLabel}>Analiz edilecek metin</Text>
                        <TextInput
                            style={at.textArea}
                            placeholder="Metninizi buraya yazın..."
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            value={manualText}
                            onChangeText={onManualTextChange}
                            multiline numberOfLines={5}
                            textAlignVertical="top"
                            selectionColor={Brand.primaryLight}
                        />
                        <Text style={at.charCount}>{manualText.length} / 512</Text>
                        {manualError && <ErrorBox msg={manualError} />}
                        <SpringButton label="Analiz Et" onPress={onManualAnalyze} loading={manualLoading} />
                        {manualResult && <SingleResultCard result={manualResult} />}
                    </View>
                </GlassCard>
            ) : (
                <GlassCard variant="default" noPadding>
                    <View style={{ padding: 18, gap: 14 }}>
                        <Text style={at.cardLabel}>Metinler (her satır = 1 metin, maks 50)</Text>
                        <TextInput
                            style={[at.textArea, { minHeight: 140 }]}
                            placeholder={"Bu ürün çok güzel!\nKötü bir deneyim.\nFiyatı uygun ama kalite orta."}
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            value={batchText}
                            onChangeText={onBatchTextChange}
                            multiline textAlignVertical="top"
                            selectionColor={Brand.primaryLight}
                        />
                        {batchError && <ErrorBox msg={batchError} />}
                        <SpringButton label="Toplu Analiz Et" onPress={onBatchAnalyze} loading={batchLoading} />
                        {batchResults && batchResults.length > 0 && <BatchResultsCard results={batchResults} />}
                    </View>
                </GlassCard>
            )}
        </ScrollView>
    );
}

const at = StyleSheet.create({
    scroll:   { padding: 20, gap: 16, paddingBottom: 40 },
    row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title:    { fontSize: 22, fontWeight: '700', color: '#fff', fontFamily: Fonts?.sansBold ?? undefined },
    subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontFamily: Fonts?.sans ?? undefined },
    modeSelector: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        padding: 3,
        gap: 0,
        borderWidth: 1,
        borderColor: UI.border,
        position: 'relative',
        overflow: 'hidden',
    },
    modeSlidingPill: {
        position: 'absolute',
        top: 3,
        left: 3,
        width: 60,
        height: 30,
        borderRadius: 8,
        backgroundColor: Brand.primary,
        shadowColor:  Brand.primary,
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    modePill:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, width: 62, alignItems: 'center' },
    modePillText:       { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600', fontFamily: Fonts?.sansSemiBold ?? undefined },
    modePillTextActive: { color: '#ffffff' },
    cardLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500', fontFamily: Fonts?.sansMedium ?? undefined },
    textArea: {
        backgroundColor:  'rgba(255,255,255,0.04)',
        borderRadius:     12,
        borderWidth:      1,
        borderColor:      UI.border,
        color:            '#fff',
        fontSize:         15,
        padding:          14,
        minHeight:        110,
        lineHeight:       22,
        fontFamily:       Fonts?.sans ?? undefined,
    },
    charCount: { fontSize: 11, color: 'rgba(255,255,255,0.28)', textAlign: 'right', marginTop: -6 },
});

// ═══════════════════════════════════════════════════════════════════════════
// YOUTUBE TAB
// ═══════════════════════════════════════════════════════════════════════════
interface YoutubeTabProps {
    url: string; onUrlChange: (u: string) => void;
    maxComments: string; onMaxCommentsChange: (v: string) => void;
    loading: boolean; result: YoutubeAnalysisResult | null;
    error: string | null; onAnalyze: () => void;
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

            <GlassCard variant="default" noPadding>
                <View style={{ padding: 18, gap: 12 }}>
                    <Text style={yt.label}>YouTube Video URL</Text>
                    <TextInput
                        style={yt.input}
                        placeholder="https://www.youtube.com/watch?v=..."
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        value={url}
                        onChangeText={onUrlChange}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        selectionColor={Brand.primaryLight}
                    />

                    <Text style={yt.label}>Maksimum Yorum Sayısı</Text>
                    <View style={yt.chipRow}>
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

                    <SpringButton label="Yorumları Analiz Et" onPress={onAnalyze} loading={loading} />

                    {loading && (
                        <View style={yt.loadingInfo}>
                            <ActivityIndicator color={Brand.primaryLight} size="small" />
                            <Text style={yt.loadingText}>Yorumlar çekiliyor ve analiz ediliyor...</Text>
                        </View>
                    )}
                </View>
            </GlassCard>

            {result && <YoutubeResultCard result={result} />}
        </ScrollView>
    );
}

const yt = StyleSheet.create({
    scroll:   { padding: 20, gap: 16, paddingBottom: 40 },
    title:    { fontSize: 22, fontWeight: '700', color: '#fff', fontFamily: Fonts?.sansBold ?? undefined },
    subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontFamily: Fonts?.sans ?? undefined },
    label:    { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500', fontFamily: Fonts?.sansMedium ?? undefined },
    input: {
        backgroundColor:  'rgba(255,255,255,0.04)',
        borderRadius:     12,
        borderWidth:      1,
        borderColor:      UI.border,
        color:            '#fff',
        fontSize:         14,
        paddingHorizontal: 14,
        paddingVertical:   13,
        fontFamily:       Fonts?.sans ?? undefined,
    },
    chipRow: { flexDirection: 'row', gap: 8 },
    chip: {
        flex: 1, alignItems: 'center', paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: UI.border,
    },
    chipActive:     { backgroundColor: 'rgba(124,58,237,0.18)', borderColor: Brand.primary },
    chipText:       { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '600', fontFamily: Fonts?.sansSemiBold ?? undefined },
    chipTextActive: { color: Brand.primaryLight },
    loadingInfo:  { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 8 },
    loadingText:  { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: Fonts?.sans ?? undefined },
});

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY TAB
// ═══════════════════════════════════════════════════════════════════════════
function HistoryTab({ jobs, loading, onRefresh }: { jobs: (HistoryJob | LiveHistoryJob)[]; loading: boolean; onRefresh: () => void }) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const typeLabel: Record<string, string> = {
        manual:    '📝 Metin',
        batch:     '📄 Toplu',
        youtube:   '▶️ YouTube',
        ecommerce: '🛒 E-Ticaret',
        gmaps:     '📍 Harita',
    };

    if (loading) return <ShimmerLoader />;

    if (jobs.length === 0) {
        return (
            <View style={hist.center}>
                <Text style={{ fontSize: 42 }}>📊</Text>
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
                renderItem={({ item, index }) => {
                    // Staggered fade-in
                    const delay = Math.min(index * 55, 400);

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
                            <Animated.View entering={FadeInDown.delay(delay).springify().damping(20)}>
                                <GlassCard variant="subtle" style={hist.liveCardBorder} noPadding>
                                    <View style={{ padding: 16, gap: 10 }}>
                                        <View style={hist.cardTop}>
                                            <View style={hist.liveBadgeWrap}>
                                                <View style={hist.liveDot} />
                                                <Text style={hist.liveTag}>📡 YouTube Live</Text>
                                            </View>
                                            <Text style={hist.date}>
                                                {new Date(liveItem.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </Text>
                                        </View>
                                        {liveItem.video_title && <Text style={hist.videoTitle} numberOfLines={2}>{liveItem.video_title}</Text>}
                                        {liveItem.channel_name && <Text style={hist.channelName}>📺 {liveItem.channel_name}</Text>}
                                        <View style={hist.liveStats}>
                                            {[
                                                { val: liveItem.total_messages.toLocaleString('tr-TR'), lbl: 'Mesaj' },
                                                { val: String(liveItem.total_buckets), lbl: 'Veri' },
                                                { val: durationStr, lbl: 'Süre' },
                                                ...(peakMeta ? [{ val: peakMeta.emoji, lbl: peakMeta.label, color: peakMeta.color }] : []),
                                            ].map((stat, i, arr) => (
                                                <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <View style={hist.liveStatItem}>
                                                        <Text style={[hist.liveStatValue, stat.color ? { color: stat.color } : {}]}>{stat.val}</Text>
                                                        <Text style={[hist.liveStatLabel, stat.color ? { color: stat.color } : {}]}>{stat.lbl}</Text>
                                                    </View>
                                                    {i < arr.length - 1 && <View style={hist.liveStatDivider} />}
                                                </View>
                                            ))}
                                        </View>
                                        {timeline.length > 0 && (
                                            <View style={{ gap: 6 }}>
                                                <Text style={hist.chartLabel}>Duygu Zaman Serisi</Text>
                                                <EmotionLineChart dataPoints={timeline} height={160} />
                                            </View>
                                        )}
                                    </View>
                                </GlassCard>
                            </Animated.View>
                        );
                    }

                    const jobItem   = item as HistoryJob;
                    const total     = jobItem.total_analyzed || 1;
                    const emotionEntries = jobItem.emotions_summary
                        ? Object.entries(jobItem.emotions_summary)
                        : [
                            ['Olumlu', jobItem.positive_count],
                            ['Olumsuz', jobItem.negative_count],
                            ['Nötr',   jobItem.neutral_count],
                          ] as [string, number][];
                    const isExpanded = expandedIds.has(jobItem.id);
                    const items = jobItem.analyzed_items ?? [];

                    return (
                        <Animated.View entering={FadeInDown.delay(delay).springify().damping(20)}>
                            <GlassCard variant="subtle" noPadding>
                                {/* ── Kart başlığı (her zaman görünür) ── */}
                                <View style={{ padding: 16, gap: 10 }}>
                                    <View style={hist.cardTop}>
                                        <Text style={hist.typeTag}>{typeLabel[jobItem.job_type] ?? jobItem.job_type}</Text>
                                        <Text style={hist.date}>
                                            {new Date(jobItem.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </Text>
                                    </View>
                                    {jobItem.youtube_video_title && (
                                        <Text style={hist.videoTitle} numberOfLines={2}>{jobItem.youtube_video_title}</Text>
                                    )}
                                    <Text style={hist.totalText}>
                                        {jobItem.job_type === 'manual' ? '1 metin' : `${jobItem.total_analyzed} metin`} analiz edildi
                                    </Text>
                                    <View style={{ gap: 8 }}>
                                        {emotionEntries.map(([label, count], i) => {
                                            const meta = getEmotionMeta(label);
                                            return (
                                                <AnimatedBar
                                                    key={label}
                                                    label={meta.label}
                                                    count={count as number}
                                                    total={total}
                                                    color={meta.color}
                                                    delay={i * 80}
                                                />
                                            );
                                        })}
                                    </View>

                                    {/* ── Genişlet / Daralt butonu ── */}
                                    {items.length > 0 && (
                                        <TouchableOpacity
                                            onPress={() => toggleExpand(jobItem.id)}
                                            style={hist.expandBtn}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={hist.expandBtnText}>
                                                {isExpanded ? '▲ Gizle' : `▼ ${items.length} yorumu gör`}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* ── Genişlemiş yorum listesi ── */}
                                {isExpanded && items.length > 0 && (
                                    <View style={hist.itemsList}>
                                        {items.map((it, ci) => {
                                            const m = getEmotionMeta(it.sentiment_label);
                                            return (
                                                <View key={ci} style={hist.commentRow}>
                                                    <View style={[hist.emotionDot, { backgroundColor: m.color }]} />
                                                    <View style={{ flex: 1, gap: 2 }}>
                                                        <Text style={hist.commentText} numberOfLines={3}>{it.analyzed_text}</Text>
                                                        <View style={hist.commentMeta}>
                                                            <Text style={[hist.commentLabel, { color: m.color }]}>{m.emoji} {m.label}</Text>
                                                            {it.youtube_author ? (
                                                                <Text style={hist.commentAuthor}>@{it.youtube_author}</Text>
                                                            ) : null}
                                                            <Text style={hist.commentConf}>{Math.round(it.confidence_score)}%</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </GlassCard>
                        </Animated.View>
                    );
                }}
            />
        </View>
    );
}

const hist = StyleSheet.create({
    center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', fontFamily: Fonts?.sansBold ?? undefined },
    emptyText:  { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts?.sans ?? undefined },
    headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    title:      { fontSize: 20, fontWeight: '700', color: '#fff', fontFamily: Fonts?.sansBold ?? undefined },
    refreshBtn: {
        backgroundColor: 'rgba(124,58,237,0.12)',
        borderRadius: 8, borderWidth: 1, borderColor: 'rgba(124,58,237,0.28)',
        paddingHorizontal: 12, paddingVertical: 6,
    },
    refreshText: { color: Brand.primaryLight, fontSize: 13, fontWeight: '600', fontFamily: Fonts?.sansSemiBold ?? undefined },
    liveCardBorder: { borderColor: 'rgba(248,113,113,0.2)' },
    liveBadgeWrap:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
    liveDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F87171' },
    liveTag:        { fontSize: 13, color: '#F87171', fontWeight: '700', fontFamily: Fonts?.sansBold ?? undefined },
    channelName:    { fontSize: 12, color: 'rgba(255,255,255,0.42)', marginTop: -4 },
    liveStats: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6,
    },
    liveStatItem:    { flex: 1, alignItems: 'center', gap: 2 },
    liveStatValue:   { fontSize: 15, fontWeight: '800', color: '#fff', fontFamily: Fonts?.sansExtraBold ?? undefined },
    liveStatLabel:   { fontSize: 10, color: 'rgba(255,255,255,0.38)', fontFamily: Fonts?.sans ?? undefined },
    liveStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.07)' },
    chartLabel:      { fontSize: 12, color: 'rgba(255,255,255,0.38)', fontWeight: '500' },
    cardTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    typeTag:         { fontSize: 13, color: Brand.primaryLight, fontWeight: '600', fontFamily: Fonts?.sansSemiBold ?? undefined },
    date:            { fontSize: 12, color: 'rgba(255,255,255,0.32)', fontFamily: Fonts?.sans ?? undefined },
    videoTitle:      { fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 18, fontWeight: '600', fontFamily: Fonts?.sansSemiBold ?? undefined },
    totalText:       { fontSize: 12, color: 'rgba(255,255,255,0.38)', fontFamily: Fonts?.sans ?? undefined },
    expandBtn: {
        marginTop: 4,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(124,58,237,0.10)',
        borderWidth: 1, borderColor: 'rgba(124,58,237,0.22)',
        borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5,
    },
    expandBtnText: { fontSize: 12, color: Brand.primaryLight, fontWeight: '600', fontFamily: Fonts?.sansSemiBold ?? undefined },
    itemsList: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        paddingHorizontal: 16,
        paddingBottom: 12,
        paddingTop: 10,
        gap: 14,
    },
    commentRow:    { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    emotionDot:    { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
    commentText:   { fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 18, fontFamily: Fonts?.sans ?? undefined },
    commentMeta:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
    commentLabel:  { fontSize: 11, fontWeight: '600', fontFamily: Fonts?.sansSemiBold ?? undefined },
    commentAuthor: { fontSize: 11, color: 'rgba(255,255,255,0.30)', fontFamily: Fonts?.sans ?? undefined },
    commentConf:   { fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: Fonts?.sans ?? undefined },
});

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE TAB
// ═══════════════════════════════════════════════════════════════════════════
function ProfileTab({ user, onSignOut }: { user: any; onSignOut: () => void }) {
    return (
        <ScrollView contentContainerStyle={prof.scroll} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeIn.duration(400)} style={prof.avatarWrap}>
                <View style={prof.avatarShadow}>
                    <LinearGradient
                        colors={Brand.gradientPrimary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={prof.avatar}
                    >
                        <Text style={prof.avatarText}>
                            {(user?.username ?? user?.email ?? 'U')[0].toUpperCase()}
                        </Text>
                    </LinearGradient>
                </View>
                <Text style={prof.name}>
                    {user?.username ?? user?.email?.split('@')[0]}
                </Text>
                <Text style={prof.email}>{user?.email}</Text>
            </Animated.View>

            <GlassCard variant="default" style={{ width: '100%' }}>
                <Text style={prof.cardTitle}>Hesap Bilgileri</Text>
                <View style={prof.row}>
                    <Text style={prof.rowKey}>Üyelik tarihi</Text>
                    <Text style={prof.rowVal}>
                        {user?.created_at
                            ? new Date(user.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
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
            </GlassCard>

            <SpringButton
                label="🚪 Çıkış Yap"
                onPress={() =>
                    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkmak istiyor musunuz?', [
                        { text: 'İptal', style: 'cancel' },
                        { text: 'Çıkış', style: 'destructive', onPress: onSignOut },
                    ])
                }
                variant="secondary"
                style={{ width: '100%', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', borderRadius: 14 }}
            />
        </ScrollView>
    );
}

const prof = StyleSheet.create({
    scroll:     { padding: 24, gap: 20, alignItems: 'center', paddingBottom: 60 },
    avatarWrap: { alignItems: 'center', gap: 10, marginTop: 16 },
    avatarShadow: {
        borderRadius:  45,
        shadowColor:   Brand.primary,
        shadowOpacity: 0.5,
        shadowRadius:  24,
        shadowOffset:  { width: 0, height: 8 },
        elevation:     10,
    },
    avatar: {
        width: 90, height: 90, borderRadius: 45,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 36, color: '#fff', fontWeight: '700', fontFamily: Fonts?.sansBold ?? undefined },
    name:       { fontSize: 20, fontWeight: '700', color: '#fff', fontFamily: Fonts?.sansBold ?? undefined },
    email:      { fontSize: 13, color: 'rgba(255,255,255,0.42)', fontFamily: Fonts?.sans ?? undefined },
    cardTitle:  { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 12, fontFamily: Fonts?.sansBold ?? undefined },
    row:        { flexDirection: 'row', justifyContent: 'space-between' },
    rowKey:     { fontSize: 13, color: 'rgba(255,255,255,0.48)', fontFamily: Fonts?.sans ?? undefined },
    rowVal:     { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500', fontFamily: Fonts?.sansMedium ?? undefined },
    divider:    { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 10 },
});

// ═══════════════════════════════════════════════════════════════════════════
// PAYLAŞILAN KÜÇÜK BİLEŞENLER
// ═══════════════════════════════════════════════════════════════════════════

function ErrorBox({ msg }: { msg: string }) {
    return (
        <View style={shared.errorBox}>
            <Text style={shared.errorText}>⚠ {msg}</Text>
        </View>
    );
}

function SingleResultCard({ result }: { result: SingleAnalysisResult }) {
    const meta = getEmotionMeta(result.label);
    return (
        <Animated.View entering={FadeInDown.springify().damping(20)} style={[shared.resultCard, { borderColor: meta.color + '40', backgroundColor: meta.bg }]}>
            <View style={shared.resultTop}>
                <Text style={shared.resultEmoji}>{meta.emoji}</Text>
                <View style={{ flex: 1 }}>
                    <Text style={[shared.resultLabel, { color: meta.color }]}>{meta.label}</Text>
                    <Text style={shared.resultConf}>%{result.confidence.toFixed(1)} güven</Text>
                </View>
                <Text style={shared.resultTime}>{result.process_time_ms}ms</Text>
            </View>

            {/* Güven çubuğu */}
            <AnimatedBar
                label="Güven"
                count={Math.round(result.confidence)}
                total={100}
                color={meta.color}
            />

            {result.scores && Object.keys(result.scores).length > 1 && (
                <View style={{ gap: 8, marginTop: 4 }}>
                    <Text style={shared.scoresTitle}>Duygu Dağılımı</Text>
                    {Object.entries(result.scores)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([lbl, pct], i) => {
                            const sm = getEmotionMeta(lbl);
                            return (
                                <AnimatedBar
                                    key={lbl}
                                    label={sm.label}
                                    count={Math.round(pct)}
                                    total={100}
                                    color={sm.color}
                                    delay={i * 70}
                                />
                            );
                        })}
                </View>
            )}
        </Animated.View>
    );
}

function BatchResultsCard({ results }: { results: { text: string; label: string; confidence: number; scores?: Record<string, number> }[] }) {
    const total  = results.length;
    const counts: Record<string, number> = {};
    for (const r of results) {
        counts[r.label] = (counts[r.label] ?? 0) + 1;
    }

    return (
        <Animated.View entering={FadeInDown.springify().damping(20)} style={shared.batchCard}>
            <Text style={shared.batchTitle}>Toplu Analiz ({total} metin)</Text>
            <View style={{ gap: 8 }}>
                {Object.entries(counts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([label, count], i) => {
                        const meta = getEmotionMeta(label);
                        return (
                            <AnimatedBar
                                key={label}
                                label={meta.label}
                                count={count}
                                total={total}
                                color={meta.color}
                                delay={i * 80}
                            />
                        );
                    })}
            </View>
            <View style={{ gap: 6 }}>
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
        </Animated.View>
    );
}

function YoutubeResultCard({ result }: { result: YoutubeAnalysisResult }) {
    const summ  = result.summary;
    const total = summ.total_analyzed || 1;
    const sortedBreakdown = Object.entries(summ.breakdown).sort(([, a], [, b]) => b.count - a.count);
    const top3  = sortedBreakdown.slice(0, 3);

    return (
        <Animated.View entering={FadeInDown.springify().damping(20)} style={{ gap: 14 }}>
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
                    <Text style={ytRes.stat}>💬 {summ.total_fetched} yorum</Text>
                    <Text style={ytRes.stat}>✅ {summ.total_analyzed} analiz</Text>
                </View>
            </LinearGradient>

            {/* Duygu dağılımı */}
            <GlassCard variant="default">
                <Text style={ytRes.sectionTitle}>Duygu Dağılımı</Text>
                {top3.length > 0 && (
                    <View style={ytRes.ringRow}>
                        {top3.map(([label, info]) => {
                            const meta = getEmotionMeta(label);
                            return (
                                <ProgressRing
                                    key={label}
                                    value={info.percentage}
                                    color={meta.color}
                                    label={meta.label}
                                    size={80}
                                />
                            );
                        })}
                    </View>
                )}
                <View style={{ gap: 8, marginTop: 8 }}>
                    {sortedBreakdown.map(([label, info], i) => {
                        const meta = getEmotionMeta(label);
                        return (
                            <AnimatedBar
                                key={label}
                                label={meta.label}
                                count={info.count}
                                total={total}
                                color={meta.color}
                                delay={i * 70}
                            />
                        );
                    })}
                </View>
            </GlassCard>

            {/* Yorum listesi */}
            {result.data && result.data.length > 0 && (
                <View style={{ gap: 10 }}>
                    <Text style={ytRes.sectionTitle}>Yorumlar ({result.data.length})</Text>
                    {result.data.slice(0, 20).map((c, i) => {
                        const meta = getEmotionMeta(c.label);
                        return (
                            <GlassCard key={i} variant="subtle" noPadding>
                                <View style={{ padding: 14, gap: 6 }}>
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
                            </GlassCard>
                        );
                    })}
                    {result.data.length > 20 && (
                        <Text style={ytRes.moreText}>+{result.data.length - 20} yorum daha...</Text>
                    )}
                </View>
            )}
        </Animated.View>
    );
}

const ytRes = StyleSheet.create({
    videoCard: {
        borderRadius: 18, borderWidth: 1,
        borderColor: 'rgba(124,58,237,0.2)',
        padding: 18, gap: 8,
    },
    videoTitle:   { fontSize: 15, fontWeight: '700', color: '#fff', lineHeight: 20, fontFamily: Fonts?.sansBold ?? undefined },
    channelName:  { fontSize: 13, color: 'rgba(255,255,255,0.52)', fontFamily: Fonts?.sans ?? undefined },
    statsRow:     { flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginTop: 4 },
    stat:         { fontSize: 12, color: 'rgba(255,255,255,0.48)', fontFamily: Fonts?.sans ?? undefined },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 12, fontFamily: Fonts?.sansBold ?? undefined },
    ringRow:      { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
    commentTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    commentAuthor: { fontSize: 12, color: 'rgba(255,255,255,0.42)', fontWeight: '500' },
    labelBadge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    labelBadgeText: { fontSize: 11, fontWeight: '700', fontFamily: Fonts?.sansBold ?? undefined },
    commentText:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18, fontFamily: Fonts?.sans ?? undefined },
    commentConf:   { fontSize: 11, color: 'rgba(255,255,255,0.28)' },
    moreText:      { textAlign: 'center', color: 'rgba(255,255,255,0.32)', fontSize: 13, paddingVertical: 8 },
});

const shared = StyleSheet.create({
    errorBox: {
        backgroundColor: 'rgba(239,68,68,0.09)',
        borderRadius:    10, borderWidth: 1,
        borderColor:     'rgba(239,68,68,0.26)',
        padding:         12,
    },
    errorText:    { color: '#FCA5A5', fontSize: 13, fontFamily: Fonts?.sans ?? undefined },
    resultCard:   { borderRadius: 16, borderWidth: 1, padding: 18, gap: 12 },
    resultTop:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
    resultEmoji:  { fontSize: 32 },
    resultLabel:  { fontSize: 20, fontWeight: '800', fontFamily: Fonts?.sansExtraBold ?? undefined },
    resultConf:   { fontSize: 13, color: 'rgba(255,255,255,0.48)', marginTop: 2, fontFamily: Fonts?.sans ?? undefined },
    resultTime:   { fontSize: 11, color: 'rgba(255,255,255,0.28)' },
    scoresTitle:  { fontSize: 12, color: 'rgba(255,255,255,0.42)', fontWeight: '500' },
    batchCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        padding: 16, gap: 14,
    },
    batchTitle:     { fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: Fonts?.sansBold ?? undefined },
    batchItem:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    batchDot:       { width: 8, height: 8, borderRadius: 4 },
    batchItemText:  { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.62)', fontFamily: Fonts?.sans ?? undefined },
    batchItemLabel: { fontSize: 12, fontWeight: '600', fontFamily: Fonts?.sansSemiBold ?? undefined },
});

// ─── Ana ekran stilleri ────────────────────────────────────────────────────
const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: UI.bg },
    header: {
        flexDirection:    'row',
        justifyContent:   'space-between',
        alignItems:       'center',
        paddingHorizontal: 20,
        paddingTop:        Platform.OS === 'ios' ? 60 : 48,
        paddingBottom:     16,
    },
    headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoWrap: {
        shadowColor:   Brand.primary,
        shadowOpacity: 0.5,
        shadowRadius:  16,
        shadowOffset:  { width: 0, height: 4 },
        elevation:     8,
    },
    headerLogo:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    headerLogoText: { fontSize: 18, color: '#fff' },
    headerGreeting: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts?.sans ?? undefined },
    headerName: {
        fontSize:   16,
        fontWeight: '700',
        color:      '#fff',
        maxWidth:   SCREEN_W * 0.45,
        fontFamily: Fonts?.sansBold ?? undefined,
    },
    signOutBtn: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius:    10, borderWidth: 1, borderColor: UI.border,
        paddingHorizontal: 14, paddingVertical: 8,
    },
    signOutText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500', fontFamily: Fonts?.sansMedium ?? undefined },
    content:     { flex: 1, overflow: 'hidden' },
});
