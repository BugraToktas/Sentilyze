/**
 * ModernTabBar — Sliding pill indicator + SVG line icon set
 *
 * Aktif sekme değişince pill withSpring ile kayar.
 * İkonlar react-native-svg ile Lucide tarzı temiz line ikonlar.
 * Arka plan: expo-blur BlurView ile frosted glass.
 */

import { useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Platform,
} from 'react-native';
import Animated, {
    useSharedValue,
    withSpring,
    withRepeat,
    withSequence,
    withTiming,
    useAnimatedStyle,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { Brand, Spring, UI, Fonts } from '@/constants/theme';

const { width: W } = Dimensions.get('window');

export type TabKey = 'analyze' | 'youtube' | 'live' | 'history' | 'profile';

interface TabItem {
    key: TabKey;
    label: string;
}

const TABS: TabItem[] = [
    { key: 'analyze', label: 'Analiz' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'live',    label: 'Canlı' },
    { key: 'history', label: 'Geçmiş' },
    { key: 'profile', label: 'Profil' },
];

const TAB_COUNT  = TABS.length;
const TAB_W      = W / TAB_COUNT;
const PILL_W     = 44;
const PILL_H     = 28;

// ─── SVG İkon Bileşenleri (Lucide tarzı 22px line ikonlar) ─────────────────

function AnalyzeIcon({ active }: { active: boolean }) {
    const c = active ? Brand.primaryLight : 'rgba(255,255,255,0.38)';
    return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M3 3v18h18" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M7 16l4-4 4 4 4-7" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}

function YoutubeIcon({ active }: { active: boolean }) {
    const c = active ? Brand.primaryLight : 'rgba(255,255,255,0.38)';
    return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.45a2.78 2.78 0 00-1.95 1.97A29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.97C5.12 20 12 20 12 20s6.88 0 8.59-.45a2.78 2.78 0 001.95-1.97A29 29 0 0023 12a29 29 0 00-.46-5.58z" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M9.75 15.02L15.5 12 9.75 8.98v6.04z" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}

function LiveIcon({ active }: { active: boolean }) {
    const c = active ? '#F87171' : 'rgba(255,255,255,0.38)';
    return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={2} stroke={c} strokeWidth={1.6} />
            <Path d="M16.24 7.76a6 6 0 010 8.49M7.76 16.24a6 6 0 010-8.49" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
            <Path d="M19.07 4.93a10 10 0 010 14.14M4.93 19.07a10 10 0 010-14.14" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
    );
}

function HistoryIcon({ active }: { active: boolean }) {
    const c = active ? Brand.primaryLight : 'rgba(255,255,255,0.38)';
    return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M12 8v4l3 3" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M3.05 11a9 9 0 1 0 .5-3M3 4v4h4" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}

function ProfileIcon({ active }: { active: boolean }) {
    const c = active ? Brand.primaryLight : 'rgba(255,255,255,0.38)';
    return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={8} r={4} stroke={c} strokeWidth={1.6} />
            <Path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
    );
}

const ICON_MAP: Record<TabKey, (active: boolean) => React.ReactElement> = {
    analyze: (a) => <AnalyzeIcon active={a} />,
    youtube: (a) => <YoutubeIcon active={a} />,
    live:    (a) => <LiveIcon    active={a} />,
    history: (a) => <HistoryIcon active={a} />,
    profile: (a) => <ProfileIcon active={a} />,
};

// ─── Canlı Pulse Dot ────────────────────────────────────────────────────────

function LivePulseDot({ active }: { active: boolean }) {
    const scale   = useSharedValue(1);
    const opacity = useSharedValue(1);

    useEffect(() => {
        if (active) {
            scale.value = withRepeat(
                withSequence(withTiming(1.6, { duration: 700 }), withTiming(1, { duration: 700 })),
                -1,
            );
            opacity.value = withRepeat(
                withSequence(withTiming(0.3, { duration: 700 }), withTiming(1, { duration: 700 })),
                -1,
            );
        } else {
            scale.value   = withTiming(1,   { duration: 200 });
            opacity.value = withTiming(0.5, { duration: 200 });
        }
    }, [active]);

    const dotStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity:   opacity.value,
    }));

    return (
        <Animated.View
            style={[
                {
                    width:           7,
                    height:          7,
                    borderRadius:    4,
                    backgroundColor: active ? '#F87171' : 'rgba(255,255,255,0.25)',
                    position:        'absolute',
                    top:             0,
                    right:           -1,
                },
                dotStyle,
            ]}
        />
    );
}

interface ModernTabBarProps {
    activeTab: TabKey;
    onTabChange: (tab: TabKey) => void;
}

export default function ModernTabBar({ activeTab, onTabChange }: ModernTabBarProps) {
    const activeIndex = TABS.findIndex(t => t.key === activeTab);
    const pillX       = useSharedValue(activeIndex * TAB_W + (TAB_W - PILL_W) / 2);

    useEffect(() => {
        const idx = TABS.findIndex(t => t.key === activeTab);
        pillX.value = withSpring(
            idx * TAB_W + (TAB_W - PILL_W) / 2,
            Spring.tabPill,
        );
    }, [activeTab]);

    const pillStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: pillX.value }],
    }));

    return (
        <View style={styles.wrapper}>
            {/* Frosted glass arka plan */}
            <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />

            {/* Üst ince çizgi */}
            <View style={styles.topBorder} />

            {/* Sliding pill */}
            <Animated.View style={[styles.pill, pillStyle]} pointerEvents="none" />

            {/* Tab öğeleri */}
            <View style={styles.tabs}>
                {TABS.map((tab) => {
                    const active = activeTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => onTabChange(tab.key)}
                            style={styles.tabItem}
                            activeOpacity={0.75}
                        >
                            <View style={{ position: 'relative' }}>
                                {ICON_MAP[tab.key](active)}
                                {tab.key === 'live' && <LivePulseDot active={active} />}
                            </View>
                            <Text style={[styles.label, active && styles.labelActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        height:          Platform.OS === 'ios' ? 82 : 64,
        paddingBottom:   Platform.OS === 'ios' ? 22 : 4,
        overflow:        'hidden',
        backgroundColor: 'rgba(5, 5, 14, 0.92)',
    },
    topBorder: {
        position:        'absolute',
        top:             0,
        left:            0,
        right:           0,
        height:          1,
        backgroundColor: UI.border,
    },
    pill: {
        position:        'absolute',
        top:             8,
        width:           PILL_W,
        height:          PILL_H,
        borderRadius:    PILL_H / 2,
        backgroundColor: 'rgba(124,58,237,0.18)',
        borderWidth:     1,
        borderColor:     'rgba(124,58,237,0.35)',
    },
    tabs: {
        flex:           1,
        flexDirection:  'row',
        alignItems:     'center',
        paddingTop:     6,
    },
    tabItem: {
        flex:           1,
        alignItems:     'center',
        justifyContent: 'center',
        gap:            3,
        paddingVertical: 2,
    },
    label: {
        fontSize:   9.5,
        color:      'rgba(255,255,255,0.35)',
        fontWeight: '500',
        fontFamily: Fonts?.sansMedium ?? undefined,
        letterSpacing: 0.1,
    },
    labelActive: {
        color:      Brand.primaryLight,
        fontWeight: '700',
        fontFamily: Fonts?.sansBold ?? undefined,
    },
});
