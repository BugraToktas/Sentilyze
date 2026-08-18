/**
 * auth/callback.tsx
 *
 * Genel amaçlı auth callback sayfası.
 * Supabase OAuth kaldırıldı; bu sayfa artık sadece
 * yükleniyor ekranı gösterir ve AuthGuard yönlendirmeyi halleder.
 *
 * İleride Strapi'ye Google OAuth eklenirse bu dosya güncellenir.
 */

import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Brand } from '@/constants/theme';

export default function AuthCallback() {
    const router = useRouter();

    useEffect(() => {
        // AuthGuard kullanıcı durumuna göre yönlendirecek.
        // Bu sayfaya gelindiyse yönlendirme bekleniyor.
        const t = setTimeout(() => {
            router.replace('/(auth)/login');
        }, 3000);
        return () => clearTimeout(t);
    }, []);

    return (
        <View style={styles.root}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.text}>Yönlendiriliyor...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#0A0A0F',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    text: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 15,
        fontWeight: '500',
    },
});
