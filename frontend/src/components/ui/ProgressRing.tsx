/**
 * ProgressRing — SVG tabanlı spring animasyonlu progress ring
 *
 * Mevcut CSS-trick CircleProgress'i tamamen değiştirir.
 * strokeDashoffset withSpring ile canlanır.
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
    useSharedValue,
    withSpring,
    useAnimatedProps,
} from 'react-native-reanimated';
import { Spring, Fonts } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
    value: number;         // 0–100
    color: string;
    label: string;
    size?: number;
    strokeWidth?: number;
}

export default function ProgressRing({
    value,
    color,
    label,
    size        = 80,
    strokeWidth = 4,
}: ProgressRingProps) {
    const radius       = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const cx           = size / 2;
    const cy           = size / 2;

    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withSpring(value, Spring.gentle);
    }, [value]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: circumference * (1 - progress.value / 100),
    }));

    return (
        <View style={styles.wrap}>
            <View style={{ width: size, height: size }}>
                <Svg width={size} height={size}>
                    {/* Track */}
                    <Circle
                        cx={cx} cy={cy} r={radius}
                        stroke="rgba(255,255,255,0.07)"
                        strokeWidth={strokeWidth}
                        fill="none"
                    />
                    {/* Animated fill */}
                    <AnimatedCircle
                        cx={cx} cy={cy} r={radius}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeDasharray={`${circumference}`}
                        animatedProps={animatedProps}
                        strokeLinecap="round"
                        transform={`rotate(-90, ${cx}, ${cy})`}
                    />
                </Svg>
                {/* Center text */}
                <View style={[StyleSheet.absoluteFill, styles.center]}>
                    <Text style={[styles.percent, { color }]}>
                        {Math.round(value)}%
                    </Text>
                </View>
            </View>
            <Text style={styles.label}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        gap:        6,
    },
    center: {
        alignItems:     'center',
        justifyContent: 'center',
    },
    percent: {
        fontSize:   13,
        fontWeight: '700',
        fontFamily: Fonts?.sansBold ?? undefined,
    },
    label: {
        fontSize:   11,
        color:      'rgba(255,255,255,0.55)',
        fontWeight: '500',
        fontFamily: Fonts?.sansMedium ?? undefined,
    },
});
