/**
 * live.tsx — Sentilyze Canlı Yayın Duygu Analizi Ekranı
 *
 * YouTube canlı yayın URL'si alır, SSE akışıyla gerçek zamanlı
 * duygu analizi yapar ve animasyonlu zaman grafiğiyle gösterir.
 */

import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Brand, getEmotionMeta } from '@/constants/theme';
import { useLiveStream } from '@/hooks/use-live-stream';
import EmotionLineChart from '@/components/EmotionLineChart';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Renk sabitler ──────────────────────────────────────────────────────────
const EMOTION_KEYS = ['mutluluk', 'uzuntu', 'ofke', 'korku', 'saskinlik'];

// ─── Mini Duygu Sayaç Kartı ─────────────────────────────────────────────────
function EmotionCounter({
    emotionKey,
    value,
    isDominant,
}: {
    emotionKey: string;
    value: number;
    isDominant: boolean;
}) {
    const meta = getEmotionMeta(emotionKey);
    return (
        <View
            style={[
                ec.card,
                isDominant && { borderColor: meta.color + '60', backgroundColor: meta.color + '15' },
            ]}
        >
            <Text style={ec.emoji}>{meta.emoji}</Text>
            <Text style={[ec.value, { color: meta.color }]}>{Math.round(value)}%</Text>
            <Text style={ec.label}>{meta.label}</Text>
            {isDominant && (
                <View style={[ec.crown, { backgroundColor: meta.color }]}>
                    <Text style={ec.crownText}>▲</Text>
                </View>
            )}
        </View>
    );
}

const ec = StyleSheet.create({
    card: {
        flex: 1,
        minWidth: (SCREEN_W - 48 - 16) / 3,
        maxWidth: (SCREEN_W - 48 - 16) / 3,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        padding: 12,
        alignItems: 'center',
        gap: 4,
    },
    emoji:     { fontSize: 22 },
    value:     { fontSize: 18, fontWeight: '800' },
    label:     { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
    crown: {
        position: 'absolute', top: 6, right: 6,
        borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1,
    },
    crownText: { fontSize: 7, color: '#fff' },
});

// ─── Ana Ekran ───────────────────────────────────────────────────────────────
export default function LiveScreen() {
    const [url, setUrl] = useState('');
    const {
        start, stop, reset,
        status, isLive, isLoading,
        dataPoints, sessionInfo, totalMessages, recentMessages, error,
    } = useLiveStream();

    // Son veri noktasındaki anlık duygu dağılımı
    const lastPoint = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : null;
    const currentEmotions = lastPoint?.emotions ?? {};
    const dominantEmotion = lastPoint?.dominant ?? null;
    const dominantMeta = dominantEmotion ? getEmotionMeta(dominantEmotion) : null;

    const handleStart = () => {
        if (url.trim()) start(url.trim());
    };

    const handleStop = () => stop();

    const handleReset = () => {
        reset();
        setUrl('');
    };

    // ── IDLE: URL giriş ekranı ───────────────────────────────────────────────
    if (status === 'idle') {
        return (
            <ScrollView
                contentContainerStyle={s.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Başlık */}
                <View style={s.titleRow}>
                    <View>
                        <Text style={s.title}>Canlı Analiz</Text>
                        <Text style={s.subtitle}>YouTube chat duygu haritası</Text>
                    </View>
                    <View style={s.liveBadge}>
                        <View style={s.liveDot} />
                        <Text style={s.liveBadgeText}>YouTube Live</Text>
                    </View>
                </View>

                {/* URL Giriş Kartı */}
                <View style={s.card}>
                    <Text style={s.cardLabel}>YouTube Canlı Yayın URL</Text>
                    <TextInput
                        style={s.input}
                        placeholder="https://www.youtube.com/watch?v=..."
                        placeholderTextColor="rgba(255,255,255,0.22)"
                        value={url}
                        onChangeText={setUrl}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        selectionColor={Brand.primaryLight}
                    />
                    <Text style={s.hint}>
                        💡 Yayının aktif ve chat'in açık olması gerekir. Her 10 saniyede bir veri noktası üretilir.
                    </Text>

                    <TouchableOpacity
                        onPress={handleStart}
                        disabled={!url.trim()}
                        activeOpacity={0.85}
                        style={[s.btnWrap, !url.trim() && { opacity: 0.4 }]}
                    >
                        <LinearGradient
                            colors={['#EF4444', '#7C3AED']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={s.btn}
                        >
                            <Text style={s.btnText}>📡 Analizi Başlat</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Nasıl çalışır */}
                <View style={s.howCard}>
                    <Text style={s.howTitle}>Nasıl Çalışır?</Text>
                    {[
                        ['1', 'YouTube canlı yayın URL\'sini yapıştır'],
                        ['2', 'Chat mesajları her 3-5 saniyede otomatik çekilir'],
                        ['3', 'Sentilyze modeli her mesajı analiz eder'],
                        ['4', 'Her 10 saniyede bir grafik güncellenir'],
                    ].map(([num, text]) => (
                        <View key={num} style={s.howRow}>
                            <View style={s.howNum}>
                                <Text style={s.howNumText}>{num}</Text>
                            </View>
                            <Text style={s.howText}>{text}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        );
    }

    // ── STARTING: Bağlanıyor ─────────────────────────────────────────────────
    if (status === 'starting') {
        return (
            <View style={s.center}>
                <ActivityIndicator color={Brand.primaryLight} size="large" />
                <Text style={s.loadingTitle}>Bağlanıyor...</Text>
                <Text style={s.loadingSubtitle}>Chat ID alınıyor ve analiz başlatılıyor</Text>
            </View>
        );
    }

    // ── ERROR ────────────────────────────────────────────────────────────────
    if (status === 'error') {
        return (
            <View style={s.center}>
                <Text style={{ fontSize: 48 }}>⚠️</Text>
                <Text style={s.errorTitle}>Bağlantı Hatası</Text>
                <Text style={s.errorMsg}>{error}</Text>
                <TouchableOpacity onPress={handleReset} style={s.retryBtn} activeOpacity={0.8}>
                    <Text style={s.retryText}>↩ Tekrar Dene</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ── LIVE veya STOPPED: Analiz ekranı ────────────────────────────────────
    return (
        <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
        >
            {/* Video Bilgisi + Durum */}
            <LinearGradient
                colors={Brand.gradientCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.videoCard}
            >
                <View style={s.videoCardTop}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.videoTitle} numberOfLines={2}>
                            {sessionInfo?.video_title ?? 'Canlı Yayın'}
                        </Text>
                        <Text style={s.channelName}>📺 {sessionInfo?.channel}</Text>
                    </View>
                    {isLive ? (
                        <View style={s.liveIndicator}>
                            <View style={s.livePulse} />
                            <Text style={s.liveText}>CANLI</Text>
                        </View>
                    ) : (
                        <View style={[s.liveIndicator, { backgroundColor: 'rgba(148,163,184,0.15)' }]}>
                            <Text style={[s.liveText, { color: '#94A3B8' }]}>BİTTİ</Text>
                        </View>
                    )}
                </View>
                <View style={s.statsRow}>
                    <Text style={s.stat}>💬 {totalMessages.toLocaleString('tr-TR')} mesaj</Text>
                    <Text style={s.stat}>📊 {dataPoints.length} veri noktası</Text>
                    <Text style={s.stat}>⏱ {dataPoints.length > 0 ? `${dataPoints[dataPoints.length - 1].bucket_sec}sn` : '0sn'}</Text>
                </View>
            </LinearGradient>

            {/* Baskın Duygu Banner */}
            {dominantMeta && (
                <LinearGradient
                    colors={[dominantMeta.color + '25', dominantMeta.color + '08']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[s.dominantBanner, { borderColor: dominantMeta.color + '40' }]}
                >
                    <Text style={s.dominantEmoji}>{dominantMeta.emoji}</Text>
                    <View>
                        <Text style={s.dominantLabel}>Baskın Duygu</Text>
                        <Text style={[s.dominantEmotion, { color: dominantMeta.color }]}>
                            {dominantMeta.label}
                        </Text>
                    </View>
                    <Text style={[s.dominantPct, { color: dominantMeta.color }]}>
                        {Math.round(currentEmotions[dominantEmotion!] ?? 0)}%
                    </Text>
                </LinearGradient>
            )}

            {/* Duygu Sayaçları */}
            <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Anlık Duygu Dağılımı</Text>
            </View>
            <View style={s.countersGrid}>
                {EMOTION_KEYS.map(key => (
                    <EmotionCounter
                        key={key}
                        emotionKey={key}
                        value={currentEmotions[key] ?? 0}
                        isDominant={dominantEmotion === key}
                    />
                ))}
            </View>

            {/* Zaman Serisi Grafiği */}
            <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Zaman Grafiği</Text>
                <Text style={s.sectionSub}>Her nokta = 10 saniyelik dilim</Text>
            </View>
            <View style={s.chartCard}>
                <EmotionLineChart
                    dataPoints={dataPoints}
                    height={220}
                    emotionKeys={EMOTION_KEYS}
                />
            </View>

            {/* Mesaj Akışı */}
            {recentMessages.length > 0 && (
                <>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>Son Mesajlar</Text>
                        <Text style={s.sectionSub}>{recentMessages.length} mesaj</Text>
                    </View>
                    <View style={s.msgList}>
                        {recentMessages.slice(0, 8).map((m, i) => {
                            const meta = getEmotionMeta(m.emotion);
                            return (
                                <View key={i} style={s.msgRow}>
                                    <View style={[s.msgDot, { backgroundColor: meta.color }]} />
                                    <Text style={s.msgText} numberOfLines={2}>{m.text}</Text>
                                    <Text style={s.msgEmotion}>{meta.emoji}</Text>
                                </View>
                            );
                        })}
                    </View>
                </>
            )}

            {/* Kontrol Butonları */}
            <View style={s.controlRow}>
                {isLive ? (
                    <TouchableOpacity onPress={handleStop} style={s.stopBtn} activeOpacity={0.8}>
                        <Text style={s.stopBtnText}>⏹ Analizi Durdur</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={handleReset} style={s.resetBtn} activeOpacity={0.8}>
                        <Text style={s.resetBtnText}>↩ Yeni Analiz</Text>
                    </TouchableOpacity>
                )}
            </View>
        </ScrollView>
    );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    scroll:      { padding: 16, gap: 14, paddingBottom: 40 },
    center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },

    // Başlık
    titleRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title:       { fontSize: 22, fontWeight: '800', color: '#fff' },
    subtitle:    { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
    liveBadge:   {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(239,68,68,0.12)',
        borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
        paddingHorizontal: 10, paddingVertical: 5,
    },
    liveDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444' },
    liveBadgeText: { color: '#EF4444', fontSize: 11, fontWeight: '700' },

    // Kart
    card: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 20, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        padding: 18, gap: 12,
    },
    cardLabel:   { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        color: '#fff', fontSize: 14,
        paddingHorizontal: 14, paddingVertical: 13,
    },
    hint:        { fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 17 },
    btnWrap:     { borderRadius: 14, overflow: 'hidden', elevation: 6,
                   shadowColor: '#EF4444', shadowOpacity: 0.4, shadowRadius: 12,
                   shadowOffset: { width: 0, height: 4 } },
    btn:         { paddingVertical: 16, alignItems: 'center' },
    btnText:     { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },

    // Nasıl çalışır
    howCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        padding: 16, gap: 12,
    },
    howTitle:    { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
    howRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
    howNum: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: 'rgba(124,58,237,0.2)',
        alignItems: 'center', justifyContent: 'center',
    },
    howNumText:  { fontSize: 11, fontWeight: '800', color: Brand.primaryLight },
    howText:     { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.55)' },

    // Loading / Error
    loadingTitle:   { fontSize: 18, fontWeight: '700', color: '#fff' },
    loadingSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)' },
    errorTitle:  { fontSize: 18, fontWeight: '700', color: '#fff' },
    errorMsg:    { fontSize: 13, color: '#FCA5A5', textAlign: 'center' },
    retryBtn: {
        backgroundColor: 'rgba(124,58,237,0.15)',
        borderRadius: 12, borderWidth: 1,
        borderColor: 'rgba(124,58,237,0.3)',
        paddingHorizontal: 20, paddingVertical: 12,
    },
    retryText:   { color: Brand.primaryLight, fontSize: 14, fontWeight: '700' },

    // Video kartı
    videoCard:   { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', padding: 16, gap: 10 },
    videoCardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    videoTitle:  { fontSize: 15, fontWeight: '700', color: '#fff', lineHeight: 20 },
    channelName: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
    liveIndicator: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(239,68,68,0.15)',
        borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
        paddingHorizontal: 8, paddingVertical: 4,
    },
    livePulse:   { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444' },
    liveText:    { color: '#EF4444', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    statsRow:    { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
    stat:        { fontSize: 12, color: 'rgba(255,255,255,0.45)' },

    // Baskın duygu banner
    dominantBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        borderRadius: 16, borderWidth: 1,
        padding: 16,
    },
    dominantEmoji:   { fontSize: 36 },
    dominantLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
    dominantEmotion: { fontSize: 22, fontWeight: '800' },
    dominantPct:     { marginLeft: 'auto', fontSize: 28, fontWeight: '900' },

    // Section başlıkları
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle:  { fontSize: 15, fontWeight: '700', color: '#fff' },
    sectionSub:    { fontSize: 11, color: 'rgba(255,255,255,0.3)' },

    // Sayaçlar
    countersGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

    // Grafik
    chartCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 18, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        padding: 14,
    },

    // Kontrol butonları
    controlRow:  { gap: 10 },
    stopBtn: {
        backgroundColor: 'rgba(239,68,68,0.12)',
        borderRadius: 14, borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
        paddingVertical: 16, alignItems: 'center',
    },
    stopBtnText: { color: '#FCA5A5', fontSize: 15, fontWeight: '700' },
    resetBtn: {
        backgroundColor: 'rgba(124,58,237,0.12)',
        borderRadius: 14, borderWidth: 1,
        borderColor: 'rgba(124,58,237,0.3)',
        paddingVertical: 16, alignItems: 'center',
    },
    resetBtnText: { color: Brand.primaryLight, fontSize: 15, fontWeight: '700' },

    // Mesaj akışı
    msgList: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    },
    msgRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 14, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    msgDot:    { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
    msgText:   { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 18 },
    msgEmotion: { fontSize: 16, flexShrink: 0 },
});

