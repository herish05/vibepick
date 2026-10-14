import { Alert, Share } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, ErrorBanner, H1, H2, Muted, Screen } from '@/ui/components';
import { api } from '@/lib/client';
import { useSession } from '@/state/session';
import { useState } from 'react';

export default function Profile() {
  const qc = useQueryClient();
  const setSignedOut = useSession((s) => s.setSignedOut);
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const ig = useQuery({ queryKey: ['instagram'], queryFn: api.instagramStatus });
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

  return (
    <Screen>
      <H1>Profile</H1>
      {error ? <ErrorBanner message={error} /> : null}
      <Card>
        <H2>{me.data?.displayName ?? me.data?.email ?? '…'}</H2>
        <Muted>{me.data?.preferences?.languages.join(', ') || 'No languages set'}</Muted>
      </Card>
      <Card>
        <H2>Instagram</H2>
        {ig.data?.available === false ? (
          <Muted>Instagram connection is not enabled on this server. Everything else works without it.</Muted>
        ) : ig.data?.connected ? (
          <>
            <Muted>Connected through Instagram's official login.</Muted>
            <Button label="Disconnect" variant="ghost" onPress={() => void run(async () => { await api.instagramDisconnect(); await qc.invalidateQueries({ queryKey: ['instagram'] }); })} />
          </>
        ) : (
          <>
            <Muted>Optional. Uses Instagram's official login; no password is ever shared with us.</Muted>
            <Button label="Connect Instagram" variant="ghost" onPress={() => void connectInstagram()} />
          </>
        )}
      </Card>
      <Card>
        <H2>Privacy</H2>
        <Button label="Export my data" variant="ghost" onPress={() => void run(async () => Share.share({ message: JSON.stringify(await api.exportData(), null, 2) }))} />
        <Button label="Delete account" variant="danger" onPress={confirmDelete} />
      </Card>
      <Button
        label="Log out"
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
