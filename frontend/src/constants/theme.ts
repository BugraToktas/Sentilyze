/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

// TriSential marka renk paleti
export const Brand = {
  // Ana gradient: mor → mavi
  primary:        '#7C3AED',   // Violet-600
  primaryLight:   '#A78BFA',   // Violet-400
  secondary:      '#2563EB',   // Blue-600
  secondaryLight: '#60A5FA',   // Blue-400

  // Duygu renkleri
  positive:       '#10B981',   // Emerald-500
  negative:       '#EF4444',   // Red-500
  neutral:        '#F59E0B',   // Amber-500

  // Auth ekranı arka planı
  authBg:         '#0A0A0F',
  authCard:       'rgba(255,255,255,0.05)',
  authBorder:     'rgba(255,255,255,0.08)',
  authInputBg:    'rgba(255,255,255,0.06)',

  // Gradient tanımları (LinearGradient için dizi olarak)
  gradientPrimary: ['#7C3AED', '#2563EB'] as const,
  gradientCard:    ['rgba(124,58,237,0.15)', 'rgba(37,99,235,0.08)'] as const,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
