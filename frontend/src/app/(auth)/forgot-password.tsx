/**
 * forgot-password.tsx — Şifremi Unuttum Ekranı (Strapi)
 *
 * Strapi'nin POST /api/auth/forgot-password endpoint'ini kullanır.
 * Email gönderimini başarıyla tetikler ve kullanıcıya bildirim verir.
 */

import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import Animated, {
    useSharedValue,
    withSpring,
    useAnimatedStyle,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Brand, Spring, UI, Fonts } from '@/constants/theme';
import MeshBackground from '@/components/ui/MeshBackground';
import GlassCard from '@/components/ui/GlassCard';
import SpringButton from '@/components/ui/SpringButton';
import SentilyzeIcon from '@/components/ui/SentilyzeIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { useToast } from '@/components/ui/Toast';

const STRAPI_URL =
    (process.env.EXPO_PUBLIC_STRAPI_URL ?? 'http://localhost:1337').replace(/\/$/, '');

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const { showToast } = useToast();

    const [email,   setEmail]   = useState('');
    const [loading, setLoading] = useState(false);
    const [sent,    setSent]    = useState(false);

    // Giriş animasyonu
    const cardY  = useSharedValue(40);
    const cardOp = useSharedValue(0);

    useEffect(() => {
        cardY.value  = withSpring(0, Spring.smooth);
        cardOp.value = withSpring(1, Spring.smooth);
    }, []);

    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: cardY.value }],
        opacity:   cardOp.value,
    }));

    const handleSend = async () => {
        if (!email.trim()) {
            showToast('Lütfen email adresinizi girin.', 'error');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${STRAPI_URL}/api/auth/forgot-password`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email: email.trim() }),
            });

            if (res.ok) {
                setSent(true);
                showToast('Şifre sıfırlama bağlantısı gönderildi!', 'success');
            } else {
                const json = await res.json().catch(() => ({}));
                const msg  = json?.error?.message ?? 'Bir hata oluştu. Tekrar deneyin.';
                showToast(msg, 'error');
            }
        } catch {
            showToast('Bağlantı hatası. İnternet bağlantınızı kontrol edin.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.root}>
            <MeshBackground />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.kav}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Logo */}
                    <Animated.View style={[styles.logoArea, cardStyle]}>
                        <View style={styles.logoWrap}>
                            <LinearGradient
                                colors={Brand.gradientPrimary}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.logoGradient}
                            >
                                <SentilyzeIcon size={34} color1="#fff" color2="rgba(255,255,255,0.8)" />
                            </LinearGradient>
                        </View>
                        <Text style={styles.appName}>Sentilyze</Text>
                        <Text style={styles.tagline}>Şifre Sıfırlama</Text>
                    </Animated.View>

                    {/* Kart */}
                    <Animated.View style={cardStyle}>
                        <GlassCard variant="elevated" noPadding>
                            <View style={styles.cardInner}>
                                {!sent ? (
                                    <>
                                        <Text style={styles.cardTitle}>Şifreni Sıfırla</Text>
                                        <Text style={styles.cardDesc}>
                                            Kayıtlı email adresine şifre sıfırlama bağlantısı göndereceğiz.
                                        </Text>

                                        <View style={styles.fieldGroup}>
                                            <Text style={styles.label}>Email Adresi</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="ornek@email.com"
                                                placeholderTextColor="rgba(255,255,255,0.22)"
                                                value={email}
                                                onChangeText={setEmail}
                                                autoCapitalize="none"
                                                keyboardType="email-address"
                                                autoComplete="email"
                                                selectionColor={Brand.primaryLight}
                                            />
                                        </View>

                                        <SpringButton
                                            label="Sıfırlama Bağlantısı Gönder"
                                            onPress={handleSend}
                                            loading={loading}
                                            style={{ marginTop: 4 }}
                                        />
                                    </>
                                ) : (
                                    /* Başarı durumu */
                                    <View style={styles.successWrap}>
                                        <View style={styles.successIcon}>
                                            <Text style={styles.successEmoji}>📧</Text>
                                        </View>
                                        <Text style={styles.successTitle}>Email Gönderildi!</Text>
                                        <Text style={styles.successDesc}>
                                            <Text style={styles.emailHighlight}>{email}</Text>
                                            {' '}adresine şifre sıfırlama bağlantısı gönderdik. Gelen kutunuzu kontrol edin.
                                        </Text>
                                        <SpringButton
                                            label="Giriş Sayfasına Dön"
                                            onPress={() => router.replace('/(auth)/login')}
                                            style={{ marginTop: 8 }}
                                        />
                                    </View>
                                )}

                                {/* Geri dön */}
                                {!sent && (
                                    <TouchableOpacity
                                        onPress={() => router.back()}
                                        style={styles.backBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.backText}>← Giriş Yap'a dön</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </GlassCard>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: UI.bg },
    kav:  { flex: 1 },
    scroll: {
        flexGrow:          1,
        justifyContent:    'center',
        paddingHorizontal: 24,
        paddingVertical:   48,
        gap:               24,
    },

    // Logo
    logoArea: { alignItems: 'center', marginBottom: 4, gap: 8 },
    logoWrap: {
        shadowColor:   Brand.primary,
        shadowOpacity: 0.55,
        shadowRadius:  24,
        shadowOffset:  { width: 0, height: 8 },
        elevation:     12,
        borderRadius:  20,
        overflow:      'hidden',
    },
    logoGradient: {
        width:          64,
        height:         64,
        borderRadius:   20,
        alignItems:     'center',
        justifyContent: 'center',
    },
    appName: {
        fontSize:      30,
        fontWeight:    '800',
        color:         '#ffffff',
        letterSpacing: 0.3,
        fontFamily:    Fonts?.sansExtraBold ?? undefined,
    },
    tagline: {
        fontSize:  13,
        color:     'rgba(255,255,255,0.4)',
        fontFamily: Fonts?.sans ?? undefined,
    },

    // Kart
    cardInner: { padding: 24, gap: 16 },
    cardTitle: {
        fontSize:     20,
        fontWeight:   '700',
        color:        '#ffffff',
        marginBottom: 2,
        fontFamily:   Fonts?.sansBold ?? undefined,
    },
    cardDesc: {
        fontSize:   14,
        color:      'rgba(255,255,255,0.48)',
        lineHeight: 20,
        fontFamily: Fonts?.sans ?? undefined,
    },

    // Form
    fieldGroup: { gap: 6 },
    label: {
        fontSize:   13,
        color:      'rgba(255,255,255,0.6)',
        fontWeight: '500',
        fontFamily: Fonts?.sansMedium ?? undefined,
    },
    input: {
        backgroundColor:  'rgba(255,255,255,0.05)',
        borderRadius:     12,
        borderWidth:      1,
        borderColor:      UI.border,
        color:            '#ffffff',
        fontSize:         15,
        paddingHorizontal: 16,
        paddingVertical:   14,
        fontFamily:       Fonts?.sans ?? undefined,
    },

    // Başarı
    successWrap: { alignItems: 'center', gap: 12, paddingVertical: 8 },
    successIcon: {
        width:          72,
        height:         72,
        borderRadius:   24,
        backgroundColor: 'rgba(124,58,237,0.15)',
        borderWidth:    1,
        borderColor:    'rgba(124,58,237,0.28)',
        alignItems:     'center',
        justifyContent: 'center',
    },
    successEmoji:  { fontSize: 36 },
    successTitle:  {
        fontSize:   20,
        fontWeight: '700',
        color:      '#ffffff',
        fontFamily: Fonts?.sansBold ?? undefined,
    },
    successDesc: {
        fontSize:   14,
        color:      'rgba(255,255,255,0.5)',
        lineHeight: 20,
        textAlign:  'center',
        fontFamily: Fonts?.sans ?? undefined,
    },
    emailHighlight: {
        color:      Brand.primaryLight,
        fontWeight: '600',
        fontFamily: Fonts?.sansSemiBold ?? undefined,
    },

    // Geri
    backBtn: { alignItems: 'center', paddingVertical: 4 },
    backText: {
        color:      'rgba(255,255,255,0.4)',
        fontSize:   14,
        fontFamily: Fonts?.sans ?? undefined,
    },
});
