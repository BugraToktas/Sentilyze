/**
 * Toast.tsx — Sentilyze Global Toast/Snackbar Sistemi
 *
 * Context tabanlı, uygulamanın her yerinden showToast() ile kullanılır.
 * Tip: success | error | info
 * Animasyon: translateY slide-in + opacity
 */

import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useRef,
} from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    Platform,
} from 'react-native';
import Animated, {
    useSharedValue,
    withSpring,
    withTiming,
    useAnimatedStyle,
    runOnJS,
} from 'react-native-reanimated';
import { Brand, Fonts } from '@/constants/theme';

const { width: W } = Dimensions.get('window');

// ─── Tip tanımları ───────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
    id:      string;
    message: string;
    type:    ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | null>(null);

// ─── Toast Konfigürasyonu ────────────────────────────────────────────────────

const TOAST_CONFIG: Record<ToastType, { color: string; bg: string; border: string; icon: string }> = {
    success: {
        color:  '#4ADE80',
        bg:     'rgba(34,197,94,0.12)',
        border: 'rgba(74,222,128,0.25)',
        icon:   '✓',
    },
    error: {
        color:  '#F87171',
        bg:     'rgba(239,68,68,0.12)',
        border: 'rgba(248,113,113,0.25)',
        icon:   '✕',
    },
    info: {
        color:  '#A78BFA',
        bg:     'rgba(124,58,237,0.12)',
        border: 'rgba(167,139,250,0.25)',
        icon:   '✦',
    },
};

// ─── Tek Toast Bileşeni ──────────────────────────────────────────────────────

function ToastItem({ toast, onDone }: { toast: ToastMessage; onDone: () => void }) {
    const cfg  = TOAST_CONFIG[toast.type];
    const ty   = useSharedValue(-120);
    const op   = useSharedValue(0);
    const done = useRef(false);

    const dismiss = useCallback(() => {
        if (done.current) return;
        done.current = true;
        ty.value = withTiming(-120, { duration: 280 });
        op.value = withTiming(0,    { duration: 280 }, (finished) => {
            if (finished) runOnJS(onDone)();
        });
    }, [onDone]);

    // Giriş animasyonu
    useEffect(() => {
        ty.value = withSpring(0,   { damping: 22, stiffness: 240 });
        op.value = withTiming(1,   { duration: 200 });

        // Otomatik kapat
        const timer = setTimeout(dismiss, 3000);
        return () => clearTimeout(timer);
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: ty.value }],
        opacity:   op.value,
    }));

    return (
        <Animated.View style={[styles.toast, { backgroundColor: cfg.bg, borderColor: cfg.border }, animStyle]}>
            <View style={[styles.iconWrap, { backgroundColor: cfg.color + '22' }]}>
                <Text style={[styles.icon, { color: cfg.color }]}>{cfg.icon}</Text>
            </View>
            <Text style={[styles.message, { color: cfg.color }]} numberOfLines={2}>
                {toast.message}
            </Text>
        </Animated.View>
    );
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev.slice(-2), { id, message, type }]); // max 3
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <View style={styles.container} pointerEvents="none">
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onDone={() => removeToast(t.id)} />
                ))}
            </View>
        </ToastContext.Provider>
    );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextType {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx;
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        position:  'absolute',
        top:       Platform.OS === 'ios' ? 58 : 40,
        left:      16,
        right:     16,
        zIndex:    9999,
        gap:       8,
        alignItems: 'center',
    },
    toast: {
        flexDirection:  'row',
        alignItems:     'center',
        gap:            12,
        borderRadius:   16,
        borderWidth:    1,
        paddingVertical:   14,
        paddingHorizontal: 16,
        width:          W - 32,
        // Glassmorphism shadow
        shadowColor:    '#000',
        shadowOpacity:  0.35,
        shadowRadius:   16,
        shadowOffset:   { width: 0, height: 6 },
        elevation:      12,
    },
    iconWrap: {
        width:          30,
        height:         30,
        borderRadius:   10,
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
    },
    icon: {
        fontSize:   14,
        fontWeight: '800',
    },
    message: {
        flex:       1,
        fontSize:   14,
        lineHeight: 19,
        fontFamily: Fonts?.sansMedium ?? undefined,
    },
});
