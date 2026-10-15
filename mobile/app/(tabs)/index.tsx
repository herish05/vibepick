import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Chip, ErrorBanner, Field, GradientCard, H2, Muted, Row, Screen, SectionTitle, Skeleton, SongRow } from '@/ui/components';
import { api } from '@/lib/client';
import { useSession } from '@/state/session';
import { defaultTarget, isSupportedMime } from '@/lib/sharing';
import { formatDuration } from '@/lib/validation';
import { colors, space } from '@/ui/theme';

const IDEAS = ['late night drive', 'beach sunset', 'gym motivation', 'birthday party', 'rainy day', 'road trip with friends'];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const setPending = useSession((s) => s.setPending);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const history = useQuery({ queryKey: ['history', 3], queryFn: () => api.history(3) });
  const name = me.data?.displayName ?? me.data?.email?.split('@')[0];

  async function pick() {
    setError(null);
    // Quality < 1 re-encodes photos so uploads stay small and fast on mobile data.
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7, allowsMultipleSelection: false });
    const a = res.assets?.[0];
    if (res.canceled || !a) return;
    const mime = a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg');
    if (!isSupportedMime(mime)) return setError('Please choose a JPEG, PNG, WebP, MP4 or MOV file.');
    const isVideo = mime.startsWith('video/');
    setPending({
      kind: 'media',
      uri: a.uri,
      name: a.fileName ?? (isVideo ? 'video.mp4' : 'photo.jpg'),
      mimeType: mime,
      isVideo,
      origin: 'gallery',
      contentTarget: defaultTarget(isVideo),
      receivedAt: new Date().toISOString(), // clock starts at pick time
    });
    router.push('/analyze');
  }

  function describe() {
    setPending({ kind: 'text', text: text.trim(), receivedAt: new Date().toISOString() });
    router.push('/analyze');
  }

  return (
    <Screen
      refreshing={history.isRefetching}
      onRefresh={() => {
        void history.refetch();
        void me.refetch();
      }}
    >
      <View style={{ gap: 2 }}>
        <Muted>{greeting()}</Muted>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>{name ? `Hi, ${name}` : 'Hi there'}</Text>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <GradientCard>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>What are you posting?</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 20 }}>Pick a photo or video and get songs that fit it. No sign-in to Instagram needed.</Text>
        <View style={{ height: space.sm }} />
        <Button label="Choose a photo or video" icon="images" variant="light" onPress={() => void pick()} />
      </GradientCard>

      <Card>
        <H2>Or describe the vibe</H2>
        <Field label="Your vibe" icon="sparkles-outline" placeholder="late night drive, Punjabi, not too popular" value={text} onChangeText={setText} maxLength={300} />
        <Row>
          {IDEAS.map((i) => (
            <Chip key={i} label={i} onPress={() => setText(i)} />
          ))}
        </Row>
        <Button label="Get songs" icon="musical-notes" disabled={text.trim().length < 3} onPress={describe} />
      </Card>

      <SectionTitle title="Recent" action={history.data?.items.length ? { label: 'See all', onPress: () => router.push('/history') } : undefined} />
      {history.isLoading ? <Skeleton /> : null}
      {history.error ? <ErrorBanner message="Could not load history" onRetry={() => void history.refetch()} /> : null}
      {history.data?.items.length === 0 ? <Muted>Your picks will show up here.</Muted> : null}
      {history.data?.items.map((h) => {
        const song = h.selected_song ?? h.top_song;
        return (
          <SongRow
            key={h.recommendation_id}
            title={song?.title ?? 'No songs'}
            artist={song?.artist ?? ''}
            meta={h.selected_song ? `Picked in ${formatDuration(h.time_to_selection_ms)}` : undefined}
            seed={song?.title ?? h.recommendation_id}
            onPress={() => router.push({ pathname: '/results', params: { id: h.recommendation_id } })}
          />
        );
      })}
    </Screen>
  );
}
