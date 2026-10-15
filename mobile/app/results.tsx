import { useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Empty, ErrorBanner, GradientCard, Muted, Screen, ScreenHeader, SectionTitle, Skeleton } from '@/ui/components';
import { RecommendationCard } from '@/ui/RecommendationCard';
import { api, events } from '@/lib/client';
import { CATEGORY_LABEL } from '@/lib/validation';
import type { RecItem } from '@/lib/types';
import { space } from '@/ui/theme';

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
  const [saved, setSaved] = useState(false);
  const impressions = useRef(false);

  useEffect(() => {
    if (!data || impressions.current) return;
    impressions.current = true;
    for (const i of data.items) void events.track({ type: 'recommendation_impression', songId: i.song_id, recommendationId: data.recommendation_id, position: i.rank });
  }, [data]);

  function select(item: RecItem) {
    if (!data) return;
    setSelected(item);
    setSaved(false);
    // First selection stamps song_selected_at: end of the time-to-selection clock.
    void events.track({ type: 'song_selected', songId: item.song_id, recommendationId: data.recommendation_id, position: item.rank });
  }

  const sections = data ? SECTION_ORDER.map((c) => ({ c, items: data.items.filter((i) => i.category === c) })).filter((s) => s.items.length) : [];

  return (
    <Screen bottomInset>
      <ScreenHeader title="Your songs" subtitle="Ranked for your content." onBack={() => router.replace('/')} />
      {isLoading ? (
        <>
          <Skeleton height={190} />
          <Skeleton height={190} />
        </>
      ) : null}
      {error ? <ErrorBanner message={error instanceof Error ? error.message : 'Could not load'} onRetry={() => void refetch()} /> : null}

      {selected && data ? (
        <GradientCard>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>SELECTED</Text>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{selected.song.title}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.9)' }}>{selected.song.artist}. Add it in Instagram's music picker, then publish.</Text>
          <View style={{ height: space.xs }} />
          <Button label="Open Instagram" icon="logo-instagram" variant="light" onPress={() => void openInstagram()} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label={saved ? 'Saved' : 'Save'}
                icon={saved ? 'heart' : 'heart-outline'}
                variant="ghost"
                onPress={() => void api.addFavorite(selected.song_id).then(() => setSaved(true))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Feedback" icon="chatbubble-ellipses-outline" variant="ghost" onPress={() => router.push({ pathname: '/feedback', params: { recId: data.recommendation_id, songId: selected.song_id } })} />
            </View>
          </View>
        </GradientCard>
      ) : null}

      {data && data.items.length === 0 ? (
        <Empty icon="musical-notes-outline" title="No matches yet" hint="Try fewer filters, or describe your vibe in a different way." />
      ) : null}
      {sections.map((s) => (
        <View key={s.c} style={{ gap: space.sm }}>
          <SectionTitle title={CATEGORY_LABEL[s.c] ?? s.c} />
          {s.items.map((item) => (
            <RecommendationCard key={item.song_id} item={item} recommendationId={data!.recommendation_id} onSelect={select} selected={selected?.song_id === item.song_id} />
          ))}
        </View>
      ))}
      {data ? <Muted>Tip: tap a song to see details, or use the play button to preview it.</Muted> : null}
      <Button label="Done" variant="ghost" onPress={() => router.replace('/')} />
    </Screen>
  );
}
