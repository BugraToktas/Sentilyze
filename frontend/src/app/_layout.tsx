// react-native-url-polyfill'i EN BAŞTA import et (Supabase URL parsing için şart)
import 'react-native-url-polyfill/auto';

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '@/hooks/use-auth';

SplashScreen.preventAutoHideAsync();

// ---------------------------------------------------------------------------
// Auth Guard — session durumuna göre kullanıcıyı yönlendirir
// ---------------------------------------------------------------------------
function AuthGuard() {
    const { session, isLoading } = useAuth();
    const segments = useSegments();
    const router   = useRouter();

    useEffect(() => {
        if (isLoading) return;

        // Splash screen'i kapat
        SplashScreen.hideAsync().catch(() => {});

        const inAuthGroup = segments[0] === '(auth)';
        const inAppGroup  = segments[0] === '(app)';

        if (!session && !inAuthGroup) {
            // Oturum yok → Login'e gönder
            router.replace('/(auth)/login');
        } else if (session && !inAppGroup) {
            // Oturum var → Dashboard'a gönder
            router.replace('/(app)/dashboard');
        }
    }, [session, isLoading]);   // segments'i bağımlılıktan çıkardık — sonsuz döngüyü önler

    return null;
}

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------
export default function RootLayout() {
    return (
        <AuthProvider>
            <StatusBar style="light" />
            <AuthGuard />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
            </Stack>
        </AuthProvider>
    );
}

