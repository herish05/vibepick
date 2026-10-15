import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { Button, Card, Cover, ErrorBanner, H1, Muted, Pill, Row, Screen, ScreenHeader, Skeleton } from '@/ui/components';
import { api } from '@/lib/client';
import { colors, space } from '@/ui/theme';

export default function SongDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const song = useQuery({ queryKey: ['song', id], queryFn: () => api.song(id as string) });
  const favs = useQuery({ queryKey: ['favorites'], queryFn: api.favorites });
  const isFav = favs.data?.items.some((s) => s.id === id) ?? false;

  async function toggleFav() {
    if (!id) return;
    await (isFav ? api.removeFavorite(id) : api.addFavorite(id));
    await qc.invalidateQueries({ queryKey: ['favorites'] });
  }

  return (
    <Screen bottomInset>
      <ScreenHeader title="Song" onBack={() => router.back()} />
      {song.isLoading ? <Skeleton height={260} /> : null}
      {song.error ? <ErrorBanner message="Could not load song" onRetry={() => void song.refetch()} /> : null}
      {song.data ? (
        <>
          <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.md }}>
            <Cover seed={song.data.title} size={180} uri={song.data.coverUrl} />
            <View style={{ alignItems: 'center', gap: 4 }}>
              <H1>{song.data.title}</H1>
              <Text style={{ color: colors.muted, fontSize: 17 }}>{song.data.artist}</Text>
            </View>
          </View>
          <Card>
            <Row>
              <Pill label={song.data.language} tone="muted" icon="language-outline" />
              {song.data.releaseYear ? <Pill label={String(song.data.releaseYear)} tone="muted" icon="calendar-outline" /> : null}
              {song.data.genres.map((g) => (
                <Pill key={g} label={g} />
              ))}
            </Row>
            {!song.data.previewUrl ? <Muted>No audio preview is available for this track.</Muted> : null}
          </Card>
          <Button
            label={isFav ? 'Remove from favorites' : 'Add to favorites'}
            icon={isFav ? 'heart' : 'heart-outline'}
            variant={isFav ? 'ghost' : 'primary'}
            onPress={() => void toggleFav()}
          />
        </>
      ) : null}
    </Screen>
  );
}
