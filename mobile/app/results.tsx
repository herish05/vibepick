import { useEffect, useRef, useState } from 'react';
import { Linking, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, ErrorBanner, H1, H2, Muted, Row, Screen, Skeleton } from '@/ui/components';
import { RecommendationCard } from '@/ui/RecommendationCard';
import { api, events } from '@/lib/client';
import { CATEGORY_LABEL } from '@/lib/validation';
import type { RecItem } from '@/lib/types';
import { colors } from '@/ui/theme';

const SECTION_ORDER = ['best_match', 'trending_match', 'your_taste', 'hidden_gem', 'social_match', 'good_match'];

async function openInstagram(): Promise<void> {
  // The user finishes publishing inside Instagram; we only deep-link there.
  try {
    await Linking.openURL('instagram://story-camera');
  } catch {
    await Linking.openURL('https://www.instagram.com/');
  }
}

export default function Results() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ['rec', id], queryFn: () => api.recommendation(id as string), enabled: Boolean(id) });
  const [selected, setSelected] = useState<RecItem | null>(null);
  const impressions = useRef(false);

  useEffect(() => {
    if (!data || impressions.current) return;
    impressions.current = true;
    for (const i of data.items) void events.track({ type: 'recommendation_impression', songId: i.song_id, recommendationId: data.recommendation_id, position: i.rank });
  }, [data]);

  function select(item: RecItem) {
    if (!data) return;
    setSelected(item);
    // First selection stamps song_selected_at: end of the time-to-selection clock.
    void events.track({ type: 'song_selected', songId: item.song_id, recommendationId: data.recommendation_id, position: item.rank });
  }

  const sections = data ? SECTION_ORDER.map((c) => ({ c, items: data.items.filter((i) => i.category === c) })).filter((s) => s.items.length) : [];

  return (
    <Screen>
      <H1>Your songs</H1>
      {isLoading ? (
        <>
          <Skeleton height={160} />
          <Skeleton height={160} />
        </>
      ) : null}
      {error ? <ErrorBanner message={error instanceof Error ? error.message : 'Could not load'} onRetry={() => void refetch()} /> : null}

      {selected && data ? (
        <Card>
          <H2>Selected: {selected.song.title}</H2>
          <Muted>{selected.song.artist}. Add it in Instagram's music picker, then publish.</Muted>
          <Button label="Open Instagram" onPress={() => void openInstagram()} />
          <Row>
            <Button label="Save" variant="ghost" onPress={() => void api.addFavorite(selected.song_id)} />
            <Button label="Feedback" variant="ghost" onPress={() => router.push({ pathname: '/feedback', params: { recId: data.recommendation_id, songId: selected.song_id } })} />
          </Row>
        </Card>
      ) : null}

      {data && data.items.length === 0 ? <Muted>No matches yet. Try fewer filters.</Muted> : null}
      {sections.map((s) => (
        <Card key={s.c}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{CATEGORY_LABEL[s.c] ?? s.c}</Text>
          {s.items.map((item) => (
            <RecommendationCard key={item.song_id} item={item} recommendationId={data!.recommendation_id} onSelect={select} />
          ))}
        </Card>
      ))}
      <Button label="Done" variant="ghost" onPress={() => router.replace('/')} />
    </Screen>
  );
}
