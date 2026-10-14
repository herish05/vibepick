import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import NetInfo from '@react-native-community/netinfo';
import { api, events, hasStoredSession } from '@/lib/client';
import { useSession } from '@/state/session';
import { toPendingContent } from '@/lib/sharing';
import { colors } from '@/ui/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Text style={{ color: colors.text, fontSize: 32, fontWeight: '800' }}>VibePick</Text>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function Shell() {
  const { status, onboarded, setSignedIn, setSignedOut, setPending } = useSession();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  // Restore session: returning users skip straight to the fast path.
  useEffect(() => {
    void (async () => {
      if (!(await hasStoredSession())) return setSignedOut();
      try {
        const me = await api.me();
        setSignedIn(me.onboarded);
      } catch {
        setSignedOut();
      }
    })();
  }, [setSignedIn, setSignedOut]);

  // Content arrives from the OS share sheet. The time-to-selection clock starts now.
  useEffect(() => {
    if (!hasShareIntent) return;
    const content = toPendingContent(
      {
        files: shareIntent.files?.map((f) => ({ path: f.path, mimeType: f.mimeType, fileName: f.fileName })),
        text: shareIntent.text,
        webUrl: shareIntent.webUrl,
      },
      new Date(),
    );
    resetShareIntent();
    if (!content) return;
    setPending(content);
    const s = useSession.getState();
    if (s.status === 'signedIn' && s.onboarded) router.push('/analyze');
  }, [hasShareIntent, shareIntent, resetShareIntent, setPending]);

  // Content shared while signed out/onboarding is opened once the user is ready.
  useEffect(() => {
    if (status === 'signedIn' && onboarded && useSession.getState().pending) router.push('/analyze');
  }, [status, onboarded]);

  // Deliver queued learning signals whenever connectivity returns.
  useEffect(() => NetInfo.addEventListener((s) => s.isConnected && void events.flush()), []);

  if (status === 'loading') return <Splash />;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedIn' && !onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedIn' && onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="analyze" options={{ presentation: 'modal' }} />
          <Stack.Screen name="results" />
          <Stack.Screen name="feedback" options={{ presentation: 'modal' }} />
          <Stack.Screen name="song/[id]" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ShareIntentProvider options={{ resetOnBackground: false }}>
      <QueryClientProvider client={queryClient}>
        <Shell />
      </QueryClientProvider>
    </ShareIntentProvider>
  );
}
