import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { Brand } from '@/constants/theme';

export default function LoginScreen() {
    const { signIn, signInGoogle } = useAuth();
    const router = useRouter();

    const [email,       setEmail]       = useState('');
    const [password,    setPassword]    = useState('');
    const [loading,     setLoading]     = useState(false);
    const [googleLoad,  setGoogleLoad]  = useState(false);
    const [focusField,  setFocusField]  = useState<'email' | 'password' | null>(null);
    const [error,       setError]       = useState<string | null>(null);

    // --- Email/Şifre Girişi ---
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
            // Başarılı giriş → Dashboard'a yönlendir
            router.replace('/(app)/dashboard');
        }
    };

    // --- Google OAuth ---
    const handleGoogle = async () => {
        setGoogleLoad(true);
        const { error: err } = await signInGoogle();
        setGoogleLoad(false);
        if (err) Alert.alert('Google Girişi', err);
    };

    return (
        <View style={styles.root}>
            {/* Arka plan gradyanı */}
            <LinearGradient
                colors={['#0A0A0F', '#120B20', '#0A0F1F']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
            />

            {/* Dekoratif ışık lekesi */}
            <View style={styles.glowTopLeft} />
            <View style={styles.glowBottomRight} />

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
                    <View style={styles.logoArea}>
                        <LinearGradient
                            colors={Brand.gradientPrimary}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.logoGradient}
                        >
                            <Text style={styles.logoIcon}>✦</Text>
                        </LinearGradient>
                        <Text style={styles.appName}>TriSential</Text>
                        <Text style={styles.tagline}>Türkçe Duygu Analizi</Text>
                    </View>

                    {/* Kart */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Giriş Yap</Text>

                        {/* Hata mesajı */}
                        {error && (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>⚠ {error}</Text>
                            </View>
                        )}

                        {/* Email */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    focusField === 'email' && styles.inputFocused,
                                ]}
                                placeholder="ornek@email.com"
                                placeholderTextColor="rgba(255,255,255,0.25)"
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
                                style={[
                                    styles.input,
                                    focusField === 'password' && styles.inputFocused,
                                ]}
                                placeholder="••••••••"
                                placeholderTextColor="rgba(255,255,255,0.25)"
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => setFocusField('password')}
                                onBlur={() => setFocusField(null)}
                                secureTextEntry
                                autoComplete="password"
                                selectionColor={Brand.primaryLight}
                            />
                        </View>

                        {/* Giriş butonu */}
                        <TouchableOpacity
                            onPress={handleSignIn}
                            disabled={loading}
                            activeOpacity={0.85}
                            style={styles.primaryBtnWrapper}
                        >
                            <LinearGradient
                                colors={Brand.gradientPrimary}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.primaryBtn}
                            >
                                {loading
                                    ? <ActivityIndicator color="#fff" size="small" />
                                    : <Text style={styles.primaryBtnText}>Giriş Yap</Text>
                                }
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Ayırıcı */}
                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>veya</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Google butonu */}
                        <TouchableOpacity
                            onPress={handleGoogle}
                            disabled={googleLoad}
                            activeOpacity={0.85}
                            style={styles.googleBtn}
                        >
                            {googleLoad
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <>
                                    <Text style={styles.googleIcon}>G</Text>
                                    <Text style={styles.googleBtnText}>Google ile Giriş</Text>
                                  </>
                            }
                        </TouchableOpacity>

                        {/* Kayıt ol linki */}
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Hesabın yok mu? </Text>
                            <Link href="/(auth)/register" asChild>
                                <TouchableOpacity>
                                    <Text style={styles.footerLink}>Kayıt Ol</Text>
                                </TouchableOpacity>
                            </Link>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#0A0A0F',
    },
    glowTopLeft: {
        position: 'absolute',
        top: -80,
        left: -80,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(124,58,237,0.18)',
        // Blur effect via shadow (gerçek blur için expo-blur eklenebilir)
    },
    glowBottomRight: {
        position: 'absolute',
        bottom: -60,
        right: -60,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: 'rgba(37,99,235,0.15)',
    },
    kav: { flex: 1 },
    scroll: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 48,
    },

    // Logo
    logoArea: {
        alignItems: 'center',
        marginBottom: 36,
    },
    logoGradient: {
        width: 64,
        height: 64,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        shadowColor: Brand.primary,
        shadowOpacity: 0.6,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
    },
    logoIcon: {
        fontSize: 28,
        color: '#fff',
    },
    appName: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.5,
    },
    tagline: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.45)',
        marginTop: 4,
        letterSpacing: 0.3,
    },

    // Kart
    card: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 28,
        gap: 16,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 4,
    },

    // Hata
    errorBox: {
        backgroundColor: 'rgba(239,68,68,0.12)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
        padding: 12,
    },
    errorText: {
        color: '#FCA5A5',
        fontSize: 13,
    },

    // Form alanları
    fieldGroup: { gap: 6 },
    label: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '500',
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        color: '#ffffff',
        fontSize: 15,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    inputFocused: {
        borderColor: Brand.primary,
        backgroundColor: 'rgba(124,58,237,0.08)',
    },

    // Giriş butonu
    primaryBtnWrapper: {
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: Brand.primary,
        shadowOpacity: 0.5,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
        marginTop: 4,
    },
    primaryBtn: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

    // Ayırıcı
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    dividerText: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 12,
    },

    // Google butonu
    googleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 14,
    },
    googleIcon: {
        fontSize: 16,
        fontWeight: '800',
        color: '#ffffff',
    },
    googleBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
    },

    // Footer
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
    footerText: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 14,
    },
    footerLink: {
        color: Brand.primaryLight,
        fontSize: 14,
        fontWeight: '600',
    },
});
