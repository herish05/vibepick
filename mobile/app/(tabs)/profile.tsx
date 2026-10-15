import { useState } from 'react';
import { Alert, Share, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Chip, ErrorBanner, H2, Icon, Muted, Pill, Row, Screen, ScreenHeader, type IconName } from '@/ui/components';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/lib/client';
import { useSession } from '@/state/session';
import { colors, gradients, space } from '@/ui/theme';

function Setting({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={colors.primary} />
        </View>
        <H2>{title}</H2>
      </View>
      {children}
    </Card>
  );
}

export default function Profile() {
  const qc = useQueryClient();
  const setSignedOut = useSession((s) => s.setSignedOut);
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const ig = useQuery({ queryKey: ['instagram'], queryFn: api.instagramStatus, retry: 0 });
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  };

  const connectInstagram = () =>
    run(async () => {
      const { url } = await api.instagramConnect();
      await WebBrowser.openBrowserAsync(url); // Instagram's official OAuth page
      await qc.invalidateQueries({ queryKey: ['instagram'] });
    });

  const confirmDelete = () =>
    Alert.alert('Delete account?', 'This permanently deletes your account, uploads and history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            await api.deleteAccount();
            qc.clear();
            setSignedOut();
          }),
      },
    ]);

  const label = me.data?.displayName ?? me.data?.email ?? '';
  const langs = me.data?.preferences?.languages ?? [];
  const igAvailable = ig.data?.available === true;

  return (
    <Screen
      refreshing={me.isRefetching}
      onRefresh={() => {
        void me.refetch();
        void ig.refetch();
      }}
    >
      <ScreenHeader title="Profile" />
      {error ? <ErrorBanner message={error} /> : null}

      <Card style={{ alignItems: 'center', paddingVertical: space.lg }}>
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>{label ? label[0]?.toUpperCase() : '?'}</Text>
        </LinearGradient>
        <H2>{label || '…'}</H2>
        {me.data?.displayName && me.data.email ? <Muted>{me.data.email}</Muted> : null}
        {langs.length ? (
          <Row>
            {langs.map((l) => (
              <Chip key={l} label={l} selected onPress={() => undefined} />
            ))}
          </Row>
        ) : (
          <Muted>No languages set</Muted>
        )}
      </Card>

      <Setting icon="logo-instagram" title="Instagram">
        {ig.isLoading ? (
          <Muted>Checking…</Muted>
        ) : ig.data?.connected ? (
          <>
            <Pill label="Connected" tone="ok" icon="checkmark-circle" />
            <Muted>Connected through Instagram's official login.</Muted>
            <Button
              label="Disconnect"
              variant="ghost"
              onPress={() =>
                void run(async () => {
                  await api.instagramDisconnect();
                  await qc.invalidateQueries({ queryKey: ['instagram'] });
                })
              }
            />
          </>
        ) : igAvailable ? (
          <>
            <Muted>Optional. Uses Instagram's official login; no password is ever shared with us.</Muted>
            <Button label="Connect Instagram" icon="link" variant="soft" onPress={() => void connectInstagram()} />
          </>
        ) : (
          <>
            <Pill label="Coming soon" tone="muted" icon="time-outline" />
            <Muted>Linking an Instagram account is not available yet. You can still share photos and videos to VibePick from Instagram or your gallery. Everything else works without it.</Muted>
          </>
        )}
      </Setting>

      <Setting icon="shield-checkmark-outline" title="Privacy">
        <Muted>Your uploads are deleted automatically after a short retention period.</Muted>
        <Button label="Export my data" icon="download-outline" variant="ghost" onPress={() => void run(async () => Share.share({ message: JSON.stringify(await api.exportData(), null, 2) }))} />
        <Button label="Delete account" icon="trash-outline" variant="danger" onPress={confirmDelete} />
      </Setting>

      <Button
        label="Log out"
        icon="log-out-outline"
        variant="ghost"
        onPress={() =>
          void run(async () => {
            await api.logout();
            qc.clear();
            setSignedOut();
          })
        }
      />
    </Screen>
  );
}
