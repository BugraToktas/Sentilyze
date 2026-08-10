import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

const supabaseUrl      = process.env.EXPO_PUBLIC_SUPABASE_URL      as string;
const supabaseAnonKey  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[TriSential] EXPO_PUBLIC_SUPABASE_URL veya EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlı değil!');
}

// ---------------------------------------------------------------------------
// SSR / Node.js ortamı tespiti
// Expo Router web için sunucu tarafında render (SSR) yapar.
// Bu ortamda `window` yoktur ve AsyncStorage çökertir.
// SSR sırasında no-op storage kullanıyoruz; client tarafında AsyncStorage.
// ---------------------------------------------------------------------------
const isServer = typeof window === 'undefined';

const noopStorage = {
    getItem:    (_key: string) => Promise.resolve(null),
    setItem:    (_key: string, _value: string) => Promise.resolve(),
    removeItem: (_key: string) => Promise.resolve(),
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage:          isServer ? noopStorage : AsyncStorage,
        autoRefreshToken: !isServer,
        persistSession:   !isServer,
        // Web'de OAuth redirect sonrası URL'deki token'ı otomatik yakala
        detectSessionInUrl: !isServer,
    },
});

// Uygulama arka plana geçince token yenilemeyi durdur, öne gelince devam et
// (Sadece native/web client ortamında çalıştır — SSR'da AppState yok)
if (!isServer) {
    AppState.addEventListener('change', (state) => {
        if (state === 'active') {
            supabase.auth.startAutoRefresh();
        } else {
            supabase.auth.stopAutoRefresh();
        }
    });
}