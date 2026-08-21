// Uygulama root layoutı

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
    useFonts,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { AuthProvider, useAuth } from '@/hooks/use-auth';

SplashScreen.preventAutoHideAsync();

// ---------------------------------------------------------------------------
// Auth Guard — session durumuna göre kullanıcıyı yönlendirir
// ---------------------------------------------------------------------------
function AuthGuard() {
    const { user, isLoading } = useAuth();
    const segments = useSegments();
    const router   = useRouter();

    useEffect(() => {
        if (isLoading) return;

        // Splash screen'i kapat
        SplashScreen.hideAsync().catch(() => {});

        const inAuthGroup = segments[0] === '(auth)';
        const inAppGroup  = segments[0] === '(app)';

        if (!user && !inAuthGroup) {
            router.replace('/(auth)/login');
        } else if (user && !inAppGroup) {
            router.replace('/(app)/dashboard');
        }
    }, [user, isLoading]);

    return null;
}

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------
export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        PlusJakartaSans_400Regular,
        PlusJakartaSans_500Medium,
        PlusJakartaSans_600SemiBold,
        PlusJakartaSans_700Bold,
        PlusJakartaSans_800ExtraBold,
    });

    useEffect(() => {
        if (fontsLoaded) {
            // Font yüklendikten sonra splash screen AuthGuard'a bırakılır
        }
    }, [fontsLoaded]);

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
