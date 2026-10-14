import Constants from 'expo-constants';

/** API origin. Override with EXPO_PUBLIC_API_URL (e.g. your LAN IP or production URL). */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? 'http://localhost:3000';
