/**
 * MeshBackground — Animasyonlu mesh gradient arka plan
 *
 * Linear / Vercel tarzı yavaş akan renkli orb'lar.
 * Her orb Reanimated withRepeat+withSequence ile translateX/Y'de kayar.
 * Üzeri BlurView ile yumuşatılır — göz yormayan, premium hissiyat.
 */

import { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    useAnimatedStyle,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { UI } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');

interface OrbConfig {
    color: string;
    size: number;
    left: number;
    top: number;
    dx: number;
    dy: number;
    dur1: number;
    dur2: number;
}

const ORBS: OrbConfig[] = [
    {
        color: UI.orb1,
        size:  W * 1.15,
        left:  -W * 0.15,
        top:   H * 0.05,
        dx: 55,  dy: 40,
        dur1: 13000, dur2: 16000,
    },
    {
        color: UI.orb2,
        size:  W * 0.95,
        left:  W * 0.25,
        top:   H * 0.38,
        dx: -45, dy: 55,
        dur1: 15000, dur2: 12000,
    },
    {
        color: UI.orb3,
        size:  W * 0.85,
        left:  W * 0.55,
        top:   -H * 0.08,
        dx: 35,  dy: -45,
        dur1: 17000, dur2: 14000,
    },
    {
        color: UI.orb4,
        size:  W * 0.75,
        left:  -W * 0.2,
        top:   H * 0.62,
        dx: -55, dy: -40,
        dur1: 12000, dur2: 18000,
    },
];

function Orb({ config }: { config: OrbConfig }) {
    const tx = useSharedValue(0);
    const ty = useSharedValue(0);

    useEffect(() => {
        tx.value = withRepeat(
            withSequence(
                withTiming(config.dx,       { duration: config.dur1 }),
                withTiming(-config.dx * 0.6, { duration: config.dur2 }),
                withTiming(0,               { duration: config.dur1 }),
            ),
            -1,
            true,
        );
        ty.value = withRepeat(
            withSequence(
                withTiming(config.dy,       { duration: config.dur2 }),
                withTiming(-config.dy * 0.5, { duration: config.dur1 }),
                withTiming(0,               { duration: config.dur2 }),
            ),
            -1,
            true,
        );
    }, []);

    const style = useAnimatedStyle(() => ({
        transform: [
            { translateX: tx.value },
            { translateY: ty.value },
        ],
    }));

    return (
        <Animated.View
            style={[
                {
                    position:     'absolute',
                    width:        config.size,
                    height:       config.size,
                    borderRadius: config.size / 2,
                    backgroundColor: config.color,
                    left: config.left,
                    top:  config.top,
                },
                style,
            ]}
        />
    );
}

export default function MeshBackground() {
    return (
        <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="none">
            {ORBS.map((orb, i) => (
                <Orb key={i} config={orb} />
            ))}
            {/* Orb'ların üzerini yumuşatan güçlü blur — renkleri çok bastırır */}
            <BlurView
                intensity={110}
                tint="dark"
                style={StyleSheet.absoluteFill}
            />
            {/* Ekstra koyu overlay — kartların net görünmesi için */}
            <View style={styles.darkOverlay} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#06060E',
        overflow: 'hidden',
    },
    darkOverlay: {
        position:        'absolute',
        top:             0,
        left:            0,
        right:           0,
        bottom:          0,
        backgroundColor: 'rgba(4, 4, 12, 0.45)',
    },
});
