/**
 * use-auth.tsx — Sentilyze Auth Hook (Strapi JWT)
 *
 * Supabase Auth'un yerini Strapi'nin kendi JWT auth sistemi alıyor.
 * - signIn  → POST /api/auth/local
 * - signUp  → POST /api/auth/local/register
 * - signOut → AsyncStorage'dan token sil
 * - Google OAuth geçici olarak kaldırıldı (Strapi tarafında konfigürasyon gerektirir)
 */

import { createContext, useContext, useEffect, useState } from 'react';
import {
    strapiSignIn,
    strapiSignUp,
    strapiSignOut,
    strapiGetMe,
    getToken,
    removeToken,
    type StrapiUser,
} from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Tip tanımları
// ---------------------------------------------------------------------------
interface AuthContextType {
    user:      StrapiUser | null;
    jwt:       string | null;
    isLoading: boolean;
    signIn:    (email: string, password: string) => Promise<{ error: string | null }>;
    signUp:    (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
    signOut:   () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const AuthContext = createContext<AuthContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser]         = useState<StrapiUser | null>(null);
    const [jwt, setJwt]           = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Uygulama açılışında mevcut token'dan kullanıcıyı geri yükle
        (async () => {
            try {
                const token = await getToken();
                if (token) {
                    const me = await strapiGetMe();
                    if (me) {
                        // Token geçerli
                        setJwt(token);
                        setUser(me);
                    } else {
                        // Token süres i dolmuş / geçersiz — temizle
                        await removeToken();
                    }
                }
            } catch (err) {
                console.error('[useAuth] Token restore hatası:', err);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    // --- Fonksiyonlar ---

    const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
        const { user: u, jwt: token, error } = await strapiSignIn(email, password);
        if (u && token) {
            setUser(u);
            setJwt(token);
        }
        return { error };
    };

    const signUp = async (
        email: string,
        password: string,
        displayName?: string
    ): Promise<{ error: string | null }> => {
        // Strapi'de username zorunlu; displayName yoksa email prefix kullan
        const username = displayName ?? email.split('@')[0];
        const { user: u, jwt: token, error } = await strapiSignUp(username, email, password);
        if (u && token) {
            setUser(u);
            setJwt(token);
        }
        return { error };
    };

    const signOut = async () => {
        await strapiSignOut();
        setUser(null);
        setJwt(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                jwt,
                isLoading,
                signIn,
                signUp,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used inside <AuthProvider>');
    }
    return ctx;
}
