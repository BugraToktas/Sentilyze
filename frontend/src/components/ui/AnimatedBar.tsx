/**
 * AnimatedBar — Spring animasyonlu duygu çubuğu
 *
 * Mevcut EmotionBar'ı değiştirir.
 * Bar genişliği withSpring ile canlanır, LinearGradient fill.
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    withSpring,
    useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Spring, Fonts } from '@/constants/theme';

interface AnimatedBarProps {
    label:     string;
    count:     number;
    total:     number;
    color:     string;
    delay?:    number;  // ms, staggered animasyon için
}

export default function AnimatedBar({ label, count, total, color, delay = 0 }: AnimatedBarProps) {
    const pct   = total > 0 ? (count / total) * 100 : 0;
    const width = useSharedValue(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            width.value = withSpring(pct, Spring.smooth);
        }, delay);
        return () => clearTimeout(timer);
    }, [pct, delay]);

    const animStyle = useAnimatedStyle(() => ({
        width: `${width.value}%` as any,
    }));

    // Rengin açık tonu (glow için)
    const colorLight = color + 'BB';

    return (
        <View style={styles.row}>
            <Text style={styles.labelText}>{label}</Text>
            <View style={styles.track}>
                <Animated.View style={[styles.fillWrap, animStyle]}>
                    <LinearGradient
                        colors={[color, colorLight]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.fill}
                    />
                </Animated.View>
            </View>
            <Text style={[styles.countText, { color }]}>{count}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           10,
    },
    labelText: {
        width:      76,
        fontSize:   12,
        color:      'rgba(255,255,255,0.6)',
        fontWeight: '500',
        fontFamily: Fonts?.sansMedium ?? undefined,
    },
    track: {
        flex:            1,
        height:          6,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius:    4,
        overflow:        'hidden',
    },
    fillWrap: {
        height:       '100%',
        overflow:     'hidden',
        borderRadius: 4,
        maxWidth:     '100%',
    },
    fill: {
        flex:         1,
        height:       '100%',
        borderRadius: 4,
    },
    countText: {
        width:      32,
        fontSize:   12,
        fontWeight: '700',
        textAlign:  'right',
        fontFamily: Fonts?.sansBold ?? undefined,
    },
});
