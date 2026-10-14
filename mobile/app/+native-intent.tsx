import Constants from 'expo-constants';

/**
 * expo-share-intent hands iOS shares to the app through a deep link
 * (`<scheme>://dataUrl=<scheme>ShareKey`). The provider reads the payload,
 * so we only need to keep the router from treating it as a missing route.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const scheme = Array.isArray(Constants.expoConfig?.scheme) ? Constants.expoConfig?.scheme[0] : Constants.expoConfig?.scheme;
    if (path.includes(`dataUrl=${scheme}ShareKey`)) return '/';
    return path;
  } catch {
    return '/';
  }
}
