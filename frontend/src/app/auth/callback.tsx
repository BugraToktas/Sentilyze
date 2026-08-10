/**
 * auth/callback.tsx
 *
 * Google OAuth sonrası Supabase'in yönlendirdiği callback sayfası.
 * URL fragment (#access_token=...&refresh_token=...) 'i Supabase'e iletir,
 * session oluştuktan sonra AuthGuard otomatik olarak dashboard'a yönlendirir.
 */

import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/constants/theme';

export default function AuthCallback() {
    useEffect(() => {
        handleCallback();
    }, []);

    const handleCallback = async () => {
        try {
            // 1) Web ortamında — URL hash'inden token al
            if (typeof window !== 'undefined' && window.location.hash) {
                const hashParams = new URLSearchParams(
                    window.location.hash.substring(1) // '#' karakterini kaldır
                );
                const accessToken  = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');

                if (accessToken && refreshToken) {
                    const { error } = await supabase.auth.setSession({
                        access_token:  accessToken,
                        refresh_token: refreshToken,
                    });
                    if (error) {
                        console.error('[AuthCallback] setSession hatası:', error.message);
                    }
                    // AuthGuard session'ı algılayıp dashboard'a yönlendirir
                    return;
                }
            }

            // 2) Native ortamda — Linking URL'sinden token al
            const url = await Linking.getInitialURL();
            if (url) {
                const parsed = Linking.parse(url);
                const accessToken  = parsed.queryParams?.access_token  as string | undefined;
                const refreshToken = parsed.queryParams?.refresh_token as string | undefined;

                if (accessToken && refreshToken) {
                    await supabase.auth.setSession({
                        access_token:  accessToken,
                        refresh_token: refreshToken,
                    });
                }
            }
        } catch (err) {
            console.error('[AuthCallback] Beklenmeyen hata:', err);
        }
    };

    return (
        <View style={styles.root}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.text}>Giriş doğrulanıyor...</Text>
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
