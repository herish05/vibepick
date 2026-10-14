import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApiClient, type TokenStore } from './api';
import { createEventQueue } from './eventQueue';
import { API_URL } from './config';
import { useSession } from '@/state/session';

const KEY = 'vp.tokens';

/** Tokens live only in the OS keystore (Keychain / Keystore), never in AsyncStorage. */
const tokens: TokenStore = {
  async get() {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as { accessToken: string; refreshToken: string }) : null;
  },
  async set(t) {
    await SecureStore.setItemAsync(KEY, JSON.stringify({ accessToken: t.accessToken, refreshToken: t.refreshToken }));
  },
  async clear() {
    await SecureStore.deleteItemAsync(KEY);
  },
};

export const api = createApiClient({
  baseUrl: API_URL,
  tokens,
  onSessionExpired: () => useSession.getState().setSignedOut(),
});

export const events = createEventQueue(AsyncStorage, (e) => api.sendInteractions(e));
export const hasStoredSession = async (): Promise<boolean> => (await tokens.get()) !== null;
