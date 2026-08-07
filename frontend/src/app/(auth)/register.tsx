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

export default function RegisterScreen() {
    const { signUp, signInGoogle } = useAuth();
    const router = useRouter();

    const [displayName, setDisplayName] = useState('');
    const [email,       setEmail]       = useState('');
    const [password,    setPassword]    = useState('');
    const [confirm,     setConfirm]     = useState('');
    const [loading,     setLoading]     = useState(false);
    const [googleLoad,  setGoogleLoad]  = useState(false);
    const [focusField,  setFocusField]  = useState<string | null>(null);
    const [error,       setError]       = useState<string | null>(null);

    const validate = (): string | null => {
        if (!displayName.trim()) return 'İsim boş olamaz.';
        if (!email.trim())       return 'Email boş olamaz.';
        if (password.length < 6) return 'Şifre en az 6 karakter olmalıdır.';
        if (password !== confirm) return 'Şifreler eşleşmiyor.';
        return null;
    };

    const handleSignUp = async () => {
        const validationError = validate();
        if (validationError) { setError(validationError); return; }

        setError(null);
        setLoading(true);
        const { error: err } = await signUp(email.trim(), password, displayName.trim());
        setLoading(false);

        if (err) {
            setError(err);
        } else {
            Alert.alert(
                'Hesap Oluşturuldu! 🎉',
                'Email adresine doğrulama bağlantısı gönderildi. Giriş yapabilirsin.',
                [{ text: 'Tamam', onPress: () => router.replace('/(auth)/login') }]
            );
        }
    };

    const handleGoogle = async () => {
        setGoogleLoad(true);
        const { error: err } = await signInGoogle();
        setGoogleLoad(false);
        if (err) Alert.alert('Google Girişi', err);
    };

    const inputStyle = (field: string) => [
        styles.input,
        focusField === field && styles.inputFocused,
    ];

    return (
        <View style={styles.root}>
            <LinearGradient
                colors={['#0A0F1F', '#120B20', '#0A0A0F']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
            />
            <View style={styles.glowTop} />
            <View style={styles.glowBottom} />

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
                        <Text style={styles.cardTitle}>Hesap Oluştur</Text>

                        {error && (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>⚠ {error}</Text>
                            </View>
                        )}

                        {/* İsim */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>İsim</Text>
                            <TextInput
                                style={inputStyle('name')}
                                placeholder="Adın Soyadın"
                                placeholderTextColor="rgba(255,255,255,0.25)"
                                value={displayName}
                                onChangeText={setDisplayName}
                                onFocus={() => setFocusField('name')}
                                onBlur={() => setFocusField(null)}
                                autoCapitalize="words"
                                autoComplete="name"
                                selectionColor={Brand.primaryLight}
                            />
                        </View>

                        {/* Email */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={inputStyle('email')}
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
                                style={inputStyle('password')}
                                placeholder="En az 6 karakter"
                                placeholderTextColor="rgba(255,255,255,0.25)"
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => setFocusField('password')}
                                onBlur={() => setFocusField(null)}
                                secureTextEntry
                                autoComplete="new-password"
                                selectionColor={Brand.primaryLight}
                            />
                        </View>

                        {/* Şifre Onayla */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Şifre Onayla</Text>
                            <TextInput
                                style={inputStyle('confirm')}
                                placeholder="••••••••"
                                placeholderTextColor="rgba(255,255,255,0.25)"
                                value={confirm}
                                onChangeText={setConfirm}
                                onFocus={() => setFocusField('confirm')}
                                onBlur={() => setFocusField(null)}
                                secureTextEntry
                                selectionColor={Brand.primaryLight}
                            />
                        </View>

                        {/* Kayıt butonu */}
                        <TouchableOpacity
                            onPress={handleSignUp}
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
                                    : <Text style={styles.primaryBtnText}>Hesap Oluştur</Text>
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
                                    <Text style={styles.googleBtnText}>Google ile Kayıt</Text>
                                  </>
                            }
                        </TouchableOpacity>

                        {/* Giriş linki */}
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Zaten hesabın var mı? </Text>
                            <Link href="/(auth)/login" asChild>
                                <TouchableOpacity>
                                    <Text style={styles.footerLink}>Giriş Yap</Text>
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
    root:         { flex: 1, backgroundColor: '#0A0A0F' },
    glowTop: {
        position: 'absolute', top: -60, right: -60,
        width: 280, height: 280, borderRadius: 140,
        backgroundColor: 'rgba(37,99,235,0.15)',
    },
    glowBottom: {
        position: 'absolute', bottom: -80, left: -80,
        width: 320, height: 320, borderRadius: 160,
        backgroundColor: 'rgba(124,58,237,0.15)',
    },
    kav:    { flex: 1 },
    scroll: {
        flexGrow: 1, justifyContent: 'center',
        paddingHorizontal: 24, paddingVertical: 48,
    },
    logoArea:     { alignItems: 'center', marginBottom: 32 },
    logoGradient: {
        width: 60, height: 60, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center', marginBottom: 10,
        shadowColor: Brand.primary, shadowOpacity: 0.6,
        shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
    },
    logoIcon:  { fontSize: 26, color: '#fff' },
    appName:   { fontSize: 26, fontWeight: '700', color: '#ffffff', letterSpacing: 0.5 },
    tagline:   { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 },

    card: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 24, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 28, gap: 14,
    },
    cardTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginBottom: 2 },

    errorBox: {
        backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 10,
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', padding: 12,
    },
    errorText: { color: '#FCA5A5', fontSize: 13 },

    fieldGroup: { gap: 6 },
    label:      { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
    input: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        color: '#ffffff', fontSize: 15,
        paddingHorizontal: 16, paddingVertical: 14,
    },
    inputFocused: { borderColor: Brand.primary, backgroundColor: 'rgba(124,58,237,0.08)' },

    primaryBtnWrapper: {
        borderRadius: 14, overflow: 'hidden',
        shadowColor: Brand.primary, shadowOpacity: 0.5,
        shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
        elevation: 6, marginTop: 4,
    },
    primaryBtn:     { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    primaryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

    divider:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
    dividerText: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },

    googleBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingVertical: 14,
    },
    googleIcon:    { fontSize: 16, fontWeight: '800', color: '#ffffff' },
    googleBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },

    footer:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
    footerText: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
    footerLink: { color: Brand.primaryLight, fontSize: 14, fontWeight: '600' },
});
