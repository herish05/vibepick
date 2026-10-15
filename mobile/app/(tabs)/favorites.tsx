import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Empty, ErrorBanner, Icon, Screen, ScreenHeader, Skeleton, SongRow } from '@/ui/components';
import { api } from '@/lib/client';
import { colors } from '@/ui/theme';

export default function Favorites() {
  const q = useQuery({ queryKey: ['favorites'], queryFn: api.favorites });
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <ScreenHeader title="Favorites" subtitle="Songs you saved for later." />
      {q.isLoading ? <Skeleton /> : null}
      {q.error ? <ErrorBanner message="Could not load favorites" onRetry={() => void q.refetch()} /> : null}
      {q.data?.items.length === 0 ? <Empty icon="heart-outline" title="No favorites yet" hint="Tap the heart on a song to save it here." /> : null}
      {q.data?.items.map((s) => (
        <SongRow
          key={s.id}
          title={s.title}
          artist={s.artist}
          meta={s.language}
          seed={s.title}
          coverUri={s.coverUrl}
          trailing={<Icon name="heart" size={20} color={colors.accent} />}
          onPress={() => router.push({ pathname: '/song/[id]', params: { id: s.id } })}
        />
      ))}
    </Screen>
  );
}
