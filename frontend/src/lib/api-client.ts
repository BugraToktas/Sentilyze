/**
 * api-client.ts — Sentilyze Strapi REST API İstemcisi
 *
 * Supabase client'ın yerini alır.
 * - JWT token'ı AsyncStorage'da saklar
 * - Her isteğe Authorization header ekler
 * - Strapi v5 REST API düz (flat) response formatı
 *
 * Strapi v5 response formatı:
 *   { data: { id, documentId, ...fields }, meta: {} }
 * Liste:
 *   { data: [{ id, documentId, ...fields }], meta: { pagination: {...} } }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STRAPI_URL =
    (process.env.EXPO_PUBLIC_STRAPI_URL ?? 'http://localhost:1337').replace(/\/$/, '');

const TOKEN_KEY = 'sentilyze_jwt';

// ─── JWT süre kontrolü (network olmadan, local) ─────────────────────────────────

/** JWT payload'ı decode et (base64 — verify yok, sadece okuma) */
function decodeJwtPayload(token: string): { exp?: number } | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(payload) as { exp?: number };
    } catch {
        return null;
    }
}

/** Token süresi dolmuş mu? (60 sn öncesinden itibaren geçersiz say) */
export function isTokenExpired(token: string): boolean {
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return true;
    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec >= payload.exp - 60; // 60 sn erken geçersiz say
}

// ─── Token yönetimi ────────────────────────────────────────────────────────────────────────────────

export async function saveToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
}

/** Token'ı al; eğer süresi dolmuşsa otomatik sil ve null döndür */
export async function getToken(): Promise<string | null> {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    if (isTokenExpired(token)) {
        await AsyncStorage.removeItem(TOKEN_KEY);
        return null;
    }
    return token;
}

export async function removeToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
}

// ─── Strapi'nin tipik response yapısı ──────────────────────────────────────

export interface StrapiSingleResponse<T> {
    data: {
        id: number;
        attributes: T;
    };
    meta: Record<string, unknown>;
}

export interface StrapiListResponse<T> {
    data: Array<{
        id: number;
        attributes: T;
    }>;
    meta: {
        pagination?: {
            page: number;
            pageSize: number;
            pageCount: number;
            total: number;
        };
    };
}

// ─── İstek fonksiyonu ───────────────────────────────────────────────────────

async function request<T>(
    path: string,
    options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
    try {
        const token = await getToken();

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> ?? {}),
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const fullUrl = `${STRAPI_URL}${path}`;
        const res = await fetch(fullUrl, {
            ...options,
            headers,
        });

        const json = await res.json();

        if (!res.ok) {
            const errMsg =
                json?.error?.message ??
                json?.message ??
                `Sunucu hatası: ${res.status}`;
            return { data: null, error: errMsg };
        }

        return { data: json as T, error: null };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Ağ bağlantısı hatası';
        return { data: null, error: msg };
    }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** GET isteği */
export function apiGet<T>(path: string) {
    return request<T>(path, { method: 'GET' });
}

/** POST isteği */
export function apiPost<T>(path: string, body: unknown) {
    return request<T>(path, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

/** PUT isteği */
export function apiPut<T>(path: string, body: unknown) {
    return request<T>(path, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

/** DELETE isteği */
export function apiDelete<T>(path: string) {
    return request<T>(path, { method: 'DELETE' });
}

// ─── Auth yardımcıları ───────────────────────────────────────────────────────

export interface StrapiUser {
    id: number;
    username: string;
    email: string;
    provider: string;
    confirmed: boolean;
    blocked: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface StrapiAuthResponse {
    jwt: string;
    user: StrapiUser;
}

/** Email + şifre ile giriş */
export async function strapiSignIn(
    identifier: string,
    password: string
): Promise<{ user: StrapiUser | null; jwt: string | null; error: string | null }> {
    // Eski / süresi dolmuş token varsa sil — login isteğine eklenmemeli
    await removeToken();

    const { data, error } = await apiPost<StrapiAuthResponse>('/api/auth/local', {
        identifier,
        password,
    });

    if (error || !data) return { user: null, jwt: null, error: error ?? 'Giriş başarısız' };

    await saveToken(data.jwt);
    return { user: data.user, jwt: data.jwt, error: null };
}

/** Yeni kullanıcı kaydı */
export async function strapiSignUp(
    username: string,
    email: string,
    password: string
): Promise<{ user: StrapiUser | null; jwt: string | null; error: string | null }> {
    const { data, error } = await apiPost<StrapiAuthResponse>('/api/auth/local/register', {
        username,
        email,
        password,
    });

    if (error || !data) return { user: null, jwt: null, error: error ?? 'Kayıt başarısız' };

    await saveToken(data.jwt);
    return { user: data.user, jwt: data.jwt, error: null };
}

/** Çıkış — token'ı sil (Strapi stateless JWT) */
export async function strapiSignOut(): Promise<void> {
    await removeToken();
}

/** Mevcut kullanıcıyı token ile al */
export async function strapiGetMe(): Promise<StrapiUser | null> {
    const { data } = await apiGet<StrapiUser>('/api/users/me');
    return data;
}
