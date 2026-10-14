import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card, Empty, ErrorBanner, H1, Muted, Screen, Skeleton } from '@/ui/components';
import { api } from '@/lib/client';
import { colors } from '@/ui/theme';

export default function Favorites() {
  const q = useQuery({ queryKey: ['favorites'], queryFn: api.favorites });
  return (
    <Screen>
      <H1>Favorites</H1>
      {q.isLoading ? <Skeleton /> : null}
      {q.error ? <ErrorBanner message="Could not load favorites" onRetry={() => void q.refetch()} /> : null}
      {q.data?.items.length === 0 ? <Empty title="No favorites yet" hint="Save songs from your results." /> : null}
      {q.data?.items.map((s) => (
        <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/song/[id]', params: { id: s.id } })}>
          <Card>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{s.title}</Text>
            <Muted>{s.artist}</Muted>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
