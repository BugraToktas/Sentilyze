/**
 * theme.ts — Sentilyze Design System
 *
 * Renk, tipografi ve ölçü tokenleri.
 * Artık dinamik emotion sistemi destekleniyor:
 *   getEmotionMeta(label) → { color, bg, emoji }
 */

import '@/global.css';

import { Platform } from 'react-native';

// ─── Premium Modern UI Token'ları ──────────────────────────────────────────
// Linear / Vercel / Raycast estetiği için ek katman
export const UI = {
  // Arka plan katmanları
  bg:          '#05050D',
  bgRaised:    '#09091A',
  bgFloat:     'rgba(9, 9, 22, 0.85)',

  // Border'lar
  border:      'rgba(255,255,255,0.07)',
  borderHover: 'rgba(255,255,255,0.13)',
  borderFocus: 'rgba(124,58,237,0.55)',

  // Mesh gradient orb renkleri — çok daha koyu ve az doygun
  orb1: 'rgba(70, 15, 140, 0.28)',    // derin mor
  orb2: 'rgba(18, 50, 160, 0.20)',    // koyu mavi
  orb3: 'rgba(45, 30, 130, 0.18)',    // koyu indigo
  orb4: 'rgba(8,  70,  70, 0.10)',    // çok hafif teal aksan

  // Glass kart gölgesi
  cardShadowColor:   '#7C3AED',
  cardShadowOpacity: 0.20,
  cardShadowRadius:  20,
} as const;

// ─── Animasyon Preset'leri (Spring fizik) ─────────────────────────────────
// withSpring(value, Spring.snappy) şeklinde kullanılır
export const Spring = {
  snappy:  { damping: 20, stiffness: 300 } as const,   // buton press
  smooth:  { damping: 25, stiffness: 200 } as const,   // kart geçişleri
  gentle:  { damping: 30, stiffness: 120 } as const,   // arka plan orb'lar
  tabPill: { damping: 22, stiffness: 250 } as const,   // tab bar pill
} as const;

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

// ─── Sentilyze marka renk paleti ─────────────────────────────────────────────
export const Brand = {
  // Ana gradient: mor → mavi
  primary:        '#7C3AED',   // Violet-600
  primaryLight:   '#A78BFA',   // Violet-400
  secondary:      '#2563EB',   // Blue-600
  secondaryLight: '#60A5FA',   // Blue-400

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

// ─── Dinamik Emotion Renk Sistemi ─────────────────────────────────────────────
// Model hangi etiket döndürürse döndürsün bu tablodan renk/emoji alınır.
// Türkçe eski etiketler (Olumlu/Olumsuz/Nötr) ve İngilizce yeni etiketler
// aynı anda desteklenir — karışık model geçişinde sorun yaşanmaz.

interface EmotionMeta {
  color: string;
  bg: string;    // rengin şeffaf versiyonu (kart arka planı)
  emoji: string;
  label: string; // görüntülenecek Türkçe etiket
}

const EMOTION_TABLE: Record<string, EmotionMeta> = {
  // ── Eski 3-sınıflı model (geriye dönük uyumluluk) ──
  'Olumlu':      { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  emoji: '😊', label: 'Olumlu' },
  'Olumsuz':     { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   emoji: '😞', label: 'Olumsuz' },
  'Nötr':        { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', emoji: '😐', label: 'Nötr' },
  'Notr':        { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', emoji: '😐', label: 'Nötr' }, // ASCII fallback

  // ── Sentilyze modeli — 5 etiket (ASCII) ──
  // Model config.json: korku / mutluluk / ofke / saskinlik / uzuntu
  'korku':       { color: '#F97316', bg: 'rgba(249,115,22,0.12)',  emoji: '😨', label: 'Korku' },
  'mutluluk':    { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   emoji: '😄', label: 'Mutluluk' },
  'ofke':        { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   emoji: '😠', label: 'Öfke' },
  'saskinlik':   { color: '#A855F7', bg: 'rgba(168,85,247,0.12)',  emoji: '😲', label: 'Şaşkınlık' },
  'uzuntu':      { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  emoji: '😢', label: 'Üzüntü' },

  // ── Türkçe çok-duygu modeli etiketleri ──
  'Sevinç':      { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   emoji: '😄', label: 'Sevinç' },
  'Mutluluk':    { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   emoji: '😊', label: 'Mutluluk' },
  'Üzüntü':      { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  emoji: '😢', label: 'Üzüntü' },
  'Öfke':        { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   emoji: '😠', label: 'Öfke' },
  'Korku':       { color: '#F97316', bg: 'rgba(249,115,22,0.12)',  emoji: '😨', label: 'Korku' },
  'Şaşkınlık':   { color: '#A855F7', bg: 'rgba(168,85,247,0.12)', emoji: '😲', label: 'Şaşkınlık' },
  'İğrenme':     { color: '#84CC16', bg: 'rgba(132,204,22,0.12)', emoji: '🤢', label: 'İğrenme' },
  'Sevgi':       { color: '#EC4899', bg: 'rgba(236,72,153,0.12)',  emoji: '🥰', label: 'Sevgi' },
  'Güven':       { color: '#14B8A6', bg: 'rgba(20,184,166,0.12)', emoji: '🤝', label: 'Güven' },
  'Beklenti':    { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', emoji: '🤔', label: 'Beklenti' },
  'İyimserlik':  { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', emoji: '🌟', label: 'İyimserlik' },
  'Kötümserlik': { color: '#6B7280', bg: 'rgba(107,114,128,0.12)',emoji: '😔', label: 'Kötümserlik' },
  'Sürpriz':     { color: '#A855F7', bg: 'rgba(168,85,247,0.12)', emoji: '🎉', label: 'Sürpriz' },
  'Hüzün':       { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', emoji: '😔', label: 'Hüzün' },
  'Endişe':      { color: '#F97316', bg: 'rgba(249,115,22,0.12)', emoji: '😟', label: 'Endişe' },
  'Hayranlık':   { color: '#A855F7', bg: 'rgba(168,85,247,0.12)', emoji: '🤩', label: 'Hayranlık' },
  'Utanç':       { color: '#EC4899', bg: 'rgba(236,72,153,0.12)', emoji: '😳', label: 'Utanç' },
  'Kıskançlık':  { color: '#84CC16', bg: 'rgba(132,204,22,0.12)', emoji: '😒', label: 'Kıskançlık' },
  'Gurur':       { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',  emoji: '😤', label: 'Gurur' },
  'Minnettarlık':{ color: '#14B8A6', bg: 'rgba(20,184,166,0.12)', emoji: '🙏', label: 'Minnettarlık' },
};


/** Fallback: bilinmeyen etiket için nötr stili */
const FALLBACK_META: EmotionMeta = {
  color: '#94A3B8',
  bg: 'rgba(148,163,184,0.12)',
  emoji: '🔍',
  label: '—',
};

/**
 * Herhangi bir model etiketinden renk, arkaplan ve emoji al.
 * Büyük/küçük harf duyarsız arama yapar.
 */
export function getEmotionMeta(rawLabel: string): EmotionMeta {
  if (!rawLabel) return FALLBACK_META;
  const key = rawLabel.trim().toLowerCase();
  // Önce lowercase anahtarda ara
  if (EMOTION_TABLE[key]) return EMOTION_TABLE[key];
  // Orijinal halinde ara (Olumlu gibi büyük harfli Türkçe)
  if (EMOTION_TABLE[rawLabel.trim()]) return EMOTION_TABLE[rawLabel.trim()];
  // Bulunamazsa fallback
  return { ...FALLBACK_META, label: rawLabel };
}

export const Fonts = Platform.select({
  ios: {
    sans: 'PlusJakartaSans_400Regular',
    sansMedium: 'PlusJakartaSans_500Medium',
    sansSemiBold: 'PlusJakartaSans_600SemiBold',
    sansBold: 'PlusJakartaSans_700Bold',
    sansExtraBold: 'PlusJakartaSans_800ExtraBold',
    mono: 'ui-monospace',
  },
  android: {
    sans: 'PlusJakartaSans_400Regular',
    sansMedium: 'PlusJakartaSans_500Medium',
    sansSemiBold: 'PlusJakartaSans_600SemiBold',
    sansBold: 'PlusJakartaSans_700Bold',
    sansExtraBold: 'PlusJakartaSans_800ExtraBold',
    mono: 'monospace',
  },
  default: {
    sans: 'PlusJakartaSans_400Regular',
    sansMedium: 'PlusJakartaSans_500Medium',
    sansSemiBold: 'PlusJakartaSans_600SemiBold',
    sansBold: 'PlusJakartaSans_700Bold',
    sansExtraBold: 'PlusJakartaSans_800ExtraBold',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    sansMedium: 'var(--font-display)',
    sansSemiBold: 'var(--font-display)',
    sansBold: 'var(--font-display)',
    sansExtraBold: 'var(--font-display)',
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
