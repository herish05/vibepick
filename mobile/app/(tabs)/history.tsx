import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card, Empty, ErrorBanner, H1, Muted, Screen, Skeleton } from '@/ui/components';
import { api } from '@/lib/client';
import { formatDuration } from '@/lib/validation';
import { colors } from '@/ui/theme';

export default function History() {
  const q = useQuery({ queryKey: ['history', 30], queryFn: () => api.history(30) });
  return (
    <Screen>
      <H1>History</H1>
      {q.isLoading ? <Skeleton /> : null}
      {q.error ? <ErrorBanner message="Could not load history" onRetry={() => void q.refetch()} /> : null}
      {q.data?.items.length === 0 ? <Empty title="Nothing yet" hint="Share a story or reel to get your first songs." /> : null}
      {q.data?.items.map((h) => {
        const song = h.selected_song ?? h.top_song;
        return (
          <Pressable key={h.recommendation_id} accessibilityRole="button" onPress={() => router.push({ pathname: '/results', params: { id: h.recommendation_id } })}>
            <Card>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{song?.title ?? 'No songs'}</Text>
              <Muted>
                {song?.artist} · {new Date(h.created_at).toLocaleDateString()} · {h.selected_song ? `picked in ${formatDuration(h.time_to_selection_ms)}` : 'not picked'}
              </Muted>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
