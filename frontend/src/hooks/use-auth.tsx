import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Tip tanımları
// ---------------------------------------------------------------------------
interface AuthContextType {
    session:     Session | null;
    user:        User | null;
    isLoading:   boolean;
    signIn:      (email: string, password: string) => Promise<{ error: string | null }>;
    signUp:      (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
    signInGoogle: () => Promise<{ error: string | null }>;
    signOut:     () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const AuthContext = createContext<AuthContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession]   = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // İlk açılışta mevcut session'ı al
        supabase.auth.getSession()
            .then(({ data }) => {
                setSession(data.session);
                setIsLoading(false);
            })
            .catch((err) => {
                console.error('[useAuth] getSession hatası:', err);
                setIsLoading(false);
            });

        // Auth durumu değişimlerini dinle (login/logout)
        const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession);
            setIsLoading(false);
        });

        return () => {
            listener.subscription.unsubscribe();
        };
    }, []);

    // --- Fonksiyonlar ---

    const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
    };

    const signUp = async (
        email: string,
        password: string,
        displayName?: string
    ): Promise<{ error: string | null }> => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: displayName ?? email.split('@')[0] },
            },
        });
        return { error: error?.message ?? null };
    };

    const signInGoogle = async (): Promise<{ error: string | null }> => {
        // OAuth için Supabase Dashboard'da Google provider'ı aktif etmek gerekiyor
        // Native: "frontend://auth/callback", Web: window.location.origin + "/auth/callback"
        const redirectTo =
            typeof window !== 'undefined'
                ? `${window.location.origin}/auth/callback`
                : 'trisential://auth/callback';

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo },
        });
        return { error: error?.message ?? null };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider
            value={{
                session,
                user: session?.user ?? null,
                isLoading,
                signIn,
                signUp,
                signInGoogle,
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
