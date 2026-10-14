import { useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { Text } from 'react-native';
import { Button, Card, ErrorBanner, Field, H1, H2, Muted, Screen, Skeleton } from '@/ui/components';
import { api } from '@/lib/client';
import { useSession } from '@/state/session';
import { defaultTarget, isSupportedMime } from '@/lib/sharing';
import { formatDuration } from '@/lib/validation';
import { colors } from '@/ui/theme';

export default function Home() {
  const setPending = useSession((s) => s.setPending);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const history = useQuery({ queryKey: ['history', 3], queryFn: () => api.history(3) });

  async function pick() {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1, allowsMultipleSelection: false });
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

  return (
    <Screen>
      <H1>What are you posting?</H1>
      <Muted>Tip: share straight from Instagram or your gallery to VibePick for the fastest flow.</Muted>
      {error ? <ErrorBanner message={error} /> : null}
      <Button label="Choose a photo or video" onPress={() => void pick()} />
      <Card>
        <H2>Or describe the vibe</H2>
        <Field label="e.g. late night drive, Punjabi, not too popular" value={text} onChangeText={setText} maxLength={300} />
        <Button
          label="Get songs"
          variant="ghost"
          disabled={text.trim().length < 3}
          onPress={() => {
            setPending({ kind: 'text', text: text.trim(), receivedAt: new Date().toISOString() });
            router.push('/analyze');
          }}
        />
      </Card>
      <H2>Recent</H2>
      {history.isLoading ? <Skeleton /> : null}
      {history.error ? <ErrorBanner message="Could not load history" onRetry={() => void history.refetch()} /> : null}
      {history.data?.items.map((h) => (
        <Card key={h.recommendation_id}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{(h.selected_song ?? h.top_song)?.title ?? 'No songs'}</Text>
          <Muted>
            {(h.selected_song ?? h.top_song)?.artist} · picked in {formatDuration(h.time_to_selection_ms)}
          </Muted>
        </Card>
      ))}
    </Screen>
  );
}
