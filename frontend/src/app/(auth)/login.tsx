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
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Spring, UI, Fonts } from '@/constants/theme';
import MeshBackground from '@/components/ui/MeshBackground';
import GlassCard from '@/components/ui/GlassCard';
import SpringButton from '@/components/ui/SpringButton';
import SentilyzeIcon from '@/components/ui/SentilyzeIcon';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen() {
    const { signIn } = useAuth();
    const router = useRouter();

    const [email,      setEmail]      = useState('');
    const [password,   setPassword]   = useState('');
    const [loading,    setLoading]    = useState(false);
    const [focusField, setFocusField] = useState<'email' | 'password' | null>(null);
    const [error,      setError]      = useState<string | null>(null);

    // Kart giriş animasyonu
    const cardY   = useSharedValue(40);
    const cardOp  = useSharedValue(0);

    useEffect(() => {
        cardY.value  = withSpring(0,   Spring.smooth);
        cardOp.value = withSpring(1,   Spring.smooth);
    }, []);

    const cardStyle = useAnimatedStyle(() => ({
        transform:  [{ translateY: cardY.value }],
        opacity:    cardOp.value,
    }));

    const handleSignIn = async () => {
        if (!email.trim() || !password.trim()) {
            setError('Email ve şifre boş olamaz.');
            return;
        }
        setError(null);
        setLoading(true);
        const { error: err } = await signIn(email.trim(), password);
        setLoading(false);
        if (err) {
            setError(err);
        } else {
            router.replace('/(app)/dashboard');
        }
    };

    return (
        <View style={styles.root}>
            {/* Animasyonlu mesh gradient arka plan */}
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
                    {/* Logo alanı */}
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
                        <Text style={styles.tagline}>Duygu Analitiği Platformu</Text>
                    </Animated.View>

                    {/* Glass kart */}
                    <Animated.View style={cardStyle}>
                        <GlassCard variant="elevated" style={{ gap: 0 }} noPadding>
                            <View style={styles.cardInner}>
                                <Text style={styles.cardTitle}>Giriş Yap</Text>

                                {error && (
                                    <View style={styles.errorBox}>
                                        <Text style={styles.errorText}>⚠ {error}</Text>
                                    </View>
                                )}

                                {/* Email */}
                                <View style={styles.fieldGroup}>
                                    <Text style={styles.label}>Email</Text>
                                    <TextInput
                                        style={[styles.input, focusField === 'email' && styles.inputFocused]}
                                        placeholder="ornek@email.com"
                                        placeholderTextColor="rgba(255,255,255,0.22)"
                                        value={email}
                                        onChangeText={setEmail}
                                        onFocus={() => setFocusField('email')}
                                        onBlur={() => setFocusField(null)}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        autoComplete="email"
                                        selectionColor={Brand.primaryLight}
                                    />
                                </View>

                                {/* Şifre */}
                                <View style={styles.fieldGroup}>
                                    <Text style={styles.label}>Şifre</Text>
                                    <TextInput
                                        style={[styles.input, focusField === 'password' && styles.inputFocused]}
                                        placeholder="••••••••"
                                        placeholderTextColor="rgba(255,255,255,0.22)"
                                        value={password}
                                        onChangeText={setPassword}
                                        onFocus={() => setFocusField('password')}
                                        onBlur={() => setFocusField(null)}
                                        secureTextEntry
                                        autoComplete="password"
                                        selectionColor={Brand.primaryLight}
                                    />
                                </View>

                                <SpringButton
                                    label="Giriş Yap"
                                    onPress={handleSignIn}
                                    loading={loading}
                                    style={{ marginTop: 4 }}
                                />

                                <View style={styles.footer}>
                                    <Text style={styles.footerText}>Hesabın yok mu? </Text>
                                    <Link href="/(auth)/register" asChild>
                                        <TouchableOpacity>
                                            <Text style={styles.footerLink}>Kayıt Ol</Text>
                                        </TouchableOpacity>
                                    </Link>
                                </View>
                            </View>
                        </GlassCard>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: UI.bg,
    },
    kav:    { flex: 1 },
    scroll: {
        flexGrow:         1,
        justifyContent:   'center',
        paddingHorizontal: 24,
        paddingVertical:   48,
        gap:               24,
    },

    // Logo
    logoArea: {
        alignItems:   'center',
        marginBottom: 4,
        gap:          8,
    },
    logoWrap: {
        shadowColor:   Brand.primary,
        shadowOpacity: 0.55,
        shadowRadius:  24,
        shadowOffset:  { width: 0, height: 8 },
        elevation:     12,
    },
    logoGradient: {
        width:          64,
        height:         64,
        borderRadius:   20,
        alignItems:     'center',
        justifyContent: 'center',
    },
    logoIcon: {
        fontSize:   28,
        color:      '#fff',
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
        letterSpacing: 0.2,
        fontFamily: Fonts?.sans ?? undefined,
    },

    // Kart
    cardInner: {
        padding: 24,
        gap:     16,
    },
    cardTitle: {
        fontSize:   20,
        fontWeight: '700',
        color:      '#ffffff',
        marginBottom: 2,
        fontFamily: Fonts?.sansBold ?? undefined,
    },

    // Hata
    errorBox: {
        backgroundColor: 'rgba(239,68,68,0.10)',
        borderRadius:    10,
        borderWidth:     1,
        borderColor:     'rgba(239,68,68,0.28)',
        padding:         12,
    },
    errorText: {
        color:      '#FCA5A5',
        fontSize:   13,
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
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius:    12,
        borderWidth:     1,
        borderColor:     UI.border,
        color:           '#ffffff',
        fontSize:        15,
        paddingHorizontal: 16,
        paddingVertical:   14,
        fontFamily:      Fonts?.sans ?? undefined,
    },
    inputFocused: {
        borderColor:     UI.borderFocus,
        backgroundColor: 'rgba(124,58,237,0.08)',
    },

    // Footer
    footer: {
        flexDirection:  'row',
        justifyContent: 'center',
        alignItems:     'center',
        marginTop:      4,
    },
    footerText: {
        color:      'rgba(255,255,255,0.4)',
        fontSize:   14,
        fontFamily: Fonts?.sans ?? undefined,
    },
    footerLink: {
        color:      Brand.primaryLight,
        fontSize:   14,
        fontWeight: '600',
        fontFamily: Fonts?.sansSemiBold ?? undefined,
    },
});
