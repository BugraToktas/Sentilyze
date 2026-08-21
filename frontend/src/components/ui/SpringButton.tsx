/**
 * SpringButton — Spring fizik animasyonlu buton
 *
 * Press'te scale: 0.96 + hafif gölge küçülmesi,
 * release'te spring ile geri gelir. LinearGradient fill.
 */

import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
    useSharedValue,
    withSpring,
    useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Brand, Spring, Fonts } from '@/constants/theme';

interface SpringButtonProps {
    label: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    variant?: 'primary' | 'secondary' | 'danger';
}

const GRADIENT_MAP = {
    primary:   Brand.gradientPrimary,
    secondary: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)'] as const,
    danger:    ['rgba(239,68,68,0.8)', 'rgba(220,38,38,0.9)'] as const,
};

export default function SpringButton({
    label,
    onPress,
    loading = false,
    disabled = false,
    style,
    variant = 'primary',
}: SpringButtonProps) {
    const scale       = useSharedValue(1);
    const shadowRadius = useSharedValue(12);

    const animStyle = useAnimatedStyle(() => ({
        transform:    [{ scale: scale.value }],
        shadowRadius: shadowRadius.value,
    }));

    const handlePressIn = () => {
        scale.value        = withSpring(0.96, Spring.snappy);
        shadowRadius.value = withSpring(4,    Spring.snappy);
    };

    const handlePressOut = () => {
        scale.value        = withSpring(1,    Spring.snappy);
        shadowRadius.value = withSpring(12,   Spring.snappy);
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || loading}
            activeOpacity={1}
            style={[styles.touchable, style]}
        >
            <Animated.View
                style={[
                    styles.shadow,
                    { shadowColor: Brand.primary },
                    animStyle,
                ]}
            >
                <LinearGradient
                    colors={GRADIENT_MAP[variant] as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradient}
                >
                    {loading
                        ? <ActivityIndicator color="#fff" size="small" />
                        : (
                            <Text style={[
                                styles.label,
                                variant === 'secondary' && styles.labelSecondary,
                            ]}>
                                {label}
                            </Text>
                        )
                    }
                </LinearGradient>
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    touchable: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    shadow: {
        borderRadius:   14,
        shadowOpacity:  0.45,
        shadowOffset:   { width: 0, height: 4 },
        elevation:      6,
    },
    gradient: {
        paddingVertical: 15,
        alignItems:     'center',
        justifyContent: 'center',
        borderRadius:   14,
    },
    label: {
        color:         '#ffffff',
        fontSize:      15,
        fontWeight:    '700',
        letterSpacing: 0.2,
        fontFamily:    Fonts?.sansBold ?? undefined,
    },
    labelSecondary: {
        color: 'rgba(255,255,255,0.8)',
    },
});
