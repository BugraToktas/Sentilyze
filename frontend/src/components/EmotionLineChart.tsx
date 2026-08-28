/**
 * EmotionLineChart.tsx — Sentilyze Animasyonlu Duygu Grafiği
 *
 * react-native-svg KULLANILMIYOR.
 * Tamamen React Native View/Animated ile çizilir — web + mobil uyumlu.
 *
 * Her duygu için renkli çizgi, dolgu gradyanı ve lejant gösterir.
 * Veri noktaları arttıkça grafik yatayda büyür (ScrollView ile kaydırılabilir).
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { getEmotionMeta } from '@/constants/theme';


const { width: SCREEN_W } = Dimensions.get('window');
const CONTAINER_W = SCREEN_W - 48;   // kart padding dahil kullanılabilir genişlik
const MIN_POINT_W = 30;               // Her veri noktası için minimum piksel

export interface DataPoint {
    bucket_sec: number;
    message_count: number;
    emotions: Record<string, number>;
    dominant: string;
}

interface EmotionLineChartProps {
    dataPoints: DataPoint[];
    height?: number;
    emotionKeys?: string[];
}

const PAD = { top: 12, right: 12, bottom: 28, left: 40 };
const Y_TICKS = [0, 25, 50, 75, 100];

// ─── Yüzdeyi piksel Y'ye çevir ─────────────────────────────────────────────
function toY(pct: number, innerH: number): number {
    return innerH - (pct / 100) * innerH;
}

// ─── Saniyeyi piksel X'e çevir ─────────────────────────────────────────────
function toX(sec: number, maxSec: number, innerW: number): number {
    return (sec / maxSec) * innerW;
}

// ─── View tabanlı çizgi segment ─────────────────────────────────────────────
function LineSegment({
    x1, y1, x2, y2, color,
}: {
    x1: number; y1: number; x2: number; y2: number; color: string;
}) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    return (
        <View
            style={{
                position:        'absolute',
                left:            x1,
                top:             y1,
                width:           length,
                height:          2,
                backgroundColor: color,
                borderRadius:    1,
                transformOrigin: 'left center',
                transform:       [{ rotate: `${angle}deg` }],
            }}
        />
    );
}

// ─── Nokta ─────────────────────────────────────────────────────────────────
function Dot({ x, y, color }: { x: number; y: number; color: string }) {
    return (
        <View
            style={{
                position:        'absolute',
                left:            x - 4,
                top:             y - 4,
                width:           8,
                height:          8,
                borderRadius:    4,
                backgroundColor: color,
                borderWidth:     1.5,
                borderColor:     '#08080F',
            }}
        />
    );
}

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────
export default function EmotionLineChart({
    dataPoints,
    height = 210,
    emotionKeys,
}: EmotionLineChartProps) {
    // Grafik genişliğini dinamik hesapla — çok fazla nokta varsa ekrana sığmaz,
    // yatay ScrollView ile kaydırılabilir olur.
    const nPoints = Math.max(dataPoints.length, 6);
    const chartW = Math.max(CONTAINER_W, nPoints * MIN_POINT_W + PAD.left + PAD.right);
    const innerW = chartW - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;

    const activeKeys = useMemo(() => {
        if (emotionKeys && emotionKeys.length > 0) return emotionKeys;
        const found = new Set<string>();
        dataPoints.forEach(pt => Object.keys(pt.emotions).forEach(k => found.add(k)));
        return Array.from(found);
    }, [dataPoints, emotionKeys]);

    const maxSec = useMemo(() => {
        if (dataPoints.length === 0) return 60;
        return Math.max(60, dataPoints[dataPoints.length - 1].bucket_sec + 10);
    }, [dataPoints]);

    // X tick değerleri
    const xTicks = useMemo(() => {
        const step = maxSec <= 120 ? 30 : maxSec <= 300 ? 60 : 120;
        const ticks: number[] = [];
        for (let t = 0; t <= maxSec; t += step) ticks.push(t);
        return ticks;
    }, [maxSec]);

    if (dataPoints.length === 0) {
        return (
            <View style={[styles.empty, { height }]}>
                <Text style={styles.emptyEmoji}>⏳</Text>
                <Text style={styles.emptyText}>Yayın başlayınca grafik burada görünecek</Text>
            </View>
        );
    }

    const isScrollable = chartW > CONTAINER_W;

    return (
        <View style={{ gap: 12 }}>
            {/* ── Grafik alanı — yatay kaydırılabilir ── */}
            {isScrollable && (
                <Text style={styles.scrollHint}>← kaydır →</Text>
            )}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEnabled={isScrollable}
                contentContainerStyle={{ paddingRight: 8 }}
            >
            <View style={{ width: chartW, height }}>
                {/* Y ekseni etiketler */}
                {Y_TICKS.map(tick => (
                    <View
                        key={tick}
                        style={{
                            position: 'absolute',
                            left:     0,
                            top:      PAD.top + toY(tick, innerH) - 7,
                            width:    PAD.left - 6,
                            alignItems: 'flex-end',
                        }}
                    >
                        <Text style={styles.axisLabel}>{tick}%</Text>
                    </View>
                ))}

                {/* Y kılavuz çizgileri */}
                {Y_TICKS.map(tick => (
                    <View
                        key={tick}
                        style={{
                            position:        'absolute',
                            left:            PAD.left,
                            top:             PAD.top + toY(tick, innerH),
                            width:           innerW,
                            height:          1,
                            backgroundColor: tick === 0
                                ? 'rgba(255,255,255,0.12)'
                                : 'rgba(255,255,255,0.05)',
                        }}
                    />
                ))}

                {/* X kılavuz çizgileri + etiketler */}
                {xTicks.map(tick => (
                    <React.Fragment key={tick}>
                        <View
                            style={{
                                position:        'absolute',
                                left:            PAD.left + toX(tick, maxSec, innerW),
                                top:             PAD.top,
                                width:           1,
                                height:          innerH,
                                backgroundColor: 'rgba(255,255,255,0.04)',
                            }}
                        />
                        <Text
                            style={[styles.axisLabel, {
                                position: 'absolute',
                                left:     PAD.left + toX(tick, maxSec, innerW) - 14,
                                top:      PAD.top + innerH + 6,
                                width:    28,
                                textAlign: 'center',
                            }]}
                        >
                            {tick < 60 ? `${tick}s` : `${Math.floor(tick / 60)}dk`}
                        </Text>
                    </React.Fragment>
                ))}

                {/* Her duygu için çizgi + noktalar */}
                {activeKeys.map(key => {
                    const meta = getEmotionMeta(key);
                    // Eksik değerler 0 olarak yorumlanır — grafik sıfıra iner
                    const pts = dataPoints.map(dp => ({
                        x: PAD.left + toX(dp.bucket_sec, maxSec, innerW),
                        y: PAD.top + toY(dp.emotions[key] ?? 0, innerH),
                    }));

                    return (
                        <React.Fragment key={key}>
                            {pts.map((pt, i) => {
                                if (i === 0) return null;
                                return (
                                    <LineSegment
                                        key={i}
                                        x1={pts[i - 1].x}
                                        y1={pts[i - 1].y}
                                        x2={pt.x}
                                        y2={pt.y}
                                        color={meta.color}
                                    />
                                );
                            })}
                            {pts.map((pt, i) => (
                                <Dot key={i} x={pt.x} y={pt.y} color={meta.color} />
                            ))}
                        </React.Fragment>
                    );
                })}
            </View>
            </ScrollView>

            {/* ── Lejant — scroll dışında sabit ── */}
            <View style={styles.legend}>
                {activeKeys.map(key => {
                    const meta = getEmotionMeta(key);
                    return (
                        <View key={key} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: meta.color }]} />
                            <Text style={styles.legendText}>{meta.label}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    empty: {
        alignItems:     'center',
        justifyContent: 'center',
        gap:            8,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius:   12,
        borderWidth:    1,
        borderColor:    'rgba(255,255,255,0.06)',
    },
    emptyEmoji: { fontSize: 28 },
    emptyText:  {
        color:     'rgba(255,255,255,0.35)',
        fontSize:  13,
        textAlign: 'center',
    },
    axisLabel: {
        fontSize: 9,
        color:    'rgba(255,255,255,0.28)',
    },
    scrollHint: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.2)',
        textAlign: 'right',
        paddingRight: 4,
        marginBottom: -4,
    },
    legend:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 4 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot:  { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
});
