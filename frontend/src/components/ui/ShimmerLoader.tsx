/**
 * ShimmerLoader — Skeleton shimmer yükleme efekti
 *
 * ActivityIndicator yerine kayan ışık efektli skeleton.
 * LinearGradient şeffaf → beyaz → şeffaf bandı ekran genişliğinde kayar.
 */

import { useEffect } from 'react';
import { View, StyleSheet, Dimensions, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
    useSharedValue,
    withRepeat,
    withTiming,
    useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W } = Dimensions.get('window');
const SHIMMER_DURATION = 1300;

// ─── Tekil Shimmer Çubuğu ──────────────────────────────────────────────────
interface ShimmerLineProps {
    width:    DimensionValue;
    height?:  number;
    style?:   ViewStyle;
    borderRadius?: number;
}

export function ShimmerLine({ width, height = 14, style, borderRadius }: ShimmerLineProps) {
    const tx = useSharedValue(-W);

    useEffect(() => {
        tx.value = withRepeat(
            withTiming(W * 1.5, { duration: SHIMMER_DURATION }),
            -1,
        );
    }, []);

    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: tx.value }],
    }));

    const br = borderRadius ?? height / 2;

    return (
        <View
            style={[
                {
                    width,
                    height,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius:    br,
                    overflow:        'hidden',
                },
                style,
            ]}
        >
            <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
                <LinearGradient
                    colors={[
                        'transparent',
                        'rgba(255,255,255,0.07)',
                        'rgba(255,255,255,0.10)',
                        'rgba(255,255,255,0.07)',
                        'transparent',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ flex: 1, width: W * 0.6 }}
                />
            </Animated.View>
        </View>
    );
}

// ─── Kart Placeholder ──────────────────────────────────────────────────────
export function ShimmerCard({ style }: { style?: ViewStyle }) {
    return (
        <View
            style={[
                {
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderRadius:    18,
                    borderWidth:     1,
                    borderColor:     'rgba(255,255,255,0.06)',
                    padding:         18,
                    gap:             14,
                },
                style,
            ]}
        >
            <ShimmerLine width="50%" height={16} />
            <ShimmerLine width="100%" height={10} />
            <ShimmerLine width="85%" height={10} />
            <ShimmerLine width="70%" height={10} />
        </View>
    );
}

// ─── Varsayılan Export: Tam ekran yükleme ──────────────────────────────────
export default function ShimmerLoader({ style }: { style?: ViewStyle }) {
    return (
        <View style={[styles.container, style]}>
            <ShimmerCard />
            <ShimmerCard />
            <ShimmerCard style={{ opacity: 0.6 }} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex:    1,
        padding: 20,
        gap:     14,
    },
});
