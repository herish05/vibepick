import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, ErrorBanner, H1, Muted, Row, Screen, Skeleton } from '@/ui/components';
import { api } from '@/lib/client';
import { Text } from 'react-native';
import { colors } from '@/ui/theme';

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
    <Screen>
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
      {song.isLoading ? <Skeleton height={140} /> : null}
      {song.error ? <ErrorBanner message="Could not load song" onRetry={() => void song.refetch()} /> : null}
      {song.data ? (
        <Card>
          <H1>{song.data.title}</H1>
          <Text style={{ color: colors.text, fontSize: 16 }}>{song.data.artist}</Text>
          <Muted>
            {song.data.language}
            {song.data.releaseYear ? ` · ${song.data.releaseYear}` : ''}
          </Muted>
          <Muted>{song.data.genres.join(', ')}</Muted>
          <Row>
            <Button label={isFav ? 'Remove from favorites' : 'Add to favorites'} variant="ghost" onPress={() => void toggleFav()} />
          </Row>
        </Card>
      ) : null}
    </Screen>
  );
}
