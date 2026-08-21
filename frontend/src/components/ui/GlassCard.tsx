/**
 * GlassCard — Gerçek glassmorphism kart bileşeni
 *
 * expo-blur BlurView ile backdrop blur + ince border.
 * Üç varyant: default / elevated / subtle
 */

import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { UI } from '@/constants/theme';

type Variant = 'default' | 'elevated' | 'subtle';

const VARIANT_CONFIG: Record<Variant, {
    intensity:      number;
    borderOpacity:  number;
    padding:        number;
    bgOpacity:      number;   // katı koyu arka plan
}> = {
    default:  { intensity: 12, borderOpacity: 0.09, padding: 18, bgOpacity: 0.72 },
    elevated: { intensity: 18, borderOpacity: 0.13, padding: 22, bgOpacity: 0.80 },
    subtle:   { intensity: 8,  borderOpacity: 0.06, padding: 16, bgOpacity: 0.60 },
};

interface GlassCardProps {
    children: React.ReactNode;
    variant?: Variant;
    style?: ViewStyle;
    padding?: number;
    borderRadius?: number;
    noPadding?: boolean;
}

export default function GlassCard({
    children,
    variant = 'default',
    style,
    padding,
    borderRadius = 20,
    noPadding = false,
}: GlassCardProps) {
    const cfg = VARIANT_CONFIG[variant];
    const p   = noPadding ? 0 : (padding ?? cfg.padding);

    return (
        <View
            style={[
                {
                    borderRadius,
                    overflow: 'hidden',
                    // Koyu katı arka plan — kart içeriği arka plan renklerinden etkilenmiyor
                    backgroundColor: `rgba(8, 8, 18, ${cfg.bgOpacity})`,
                },
                style,
            ]}
        >
            <BlurView intensity={cfg.intensity} tint="dark" style={styles.blur}>
                <View
                    style={{
                        borderWidth:  1,
                        borderColor:  `rgba(255,255,255,${cfg.borderOpacity})`,
                        borderRadius,
                        padding:      p,
                    }}
                >
                    {children}
                </View>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    blur: {
        flex: 1,
    },
});
