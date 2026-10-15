import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Empty, ErrorBanner, Screen, ScreenHeader, Skeleton, SongRow } from '@/ui/components';
import { api } from '@/lib/client';
import { formatDuration } from '@/lib/validation';

export default function History() {
  const q = useQuery({ queryKey: ['history', 30], queryFn: () => api.history(30) });
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <ScreenHeader title="History" subtitle="Songs we suggested for your content." />
      {q.isLoading ? <Skeleton /> : null}
      {q.error ? <ErrorBanner message="Could not load history" onRetry={() => void q.refetch()} /> : null}
      {q.data?.items.length === 0 ? <Empty icon="time-outline" title="Nothing yet" hint="Share a story or reel to get your first songs." /> : null}
      {q.data?.items.map((h) => {
        const song = h.selected_song ?? h.top_song;
        return (
          <SongRow
            key={h.recommendation_id}
            title={song?.title ?? 'No songs'}
            artist={song?.artist ?? ''}
            meta={`${new Date(h.created_at).toLocaleDateString()} · ${h.selected_song ? `picked in ${formatDuration(h.time_to_selection_ms)}` : 'not picked'}`}
            seed={song?.title ?? h.recommendation_id}
            onPress={() => router.push({ pathname: '/results', params: { id: h.recommendation_id } })}
          />
        );
      })}
    </Screen>
  );
}
