import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card, Chip, Empty, ErrorBanner, Field, H1, Muted, Row, Screen, Skeleton } from '@/ui/components';
import { api, events } from '@/lib/client';
import { LANGUAGES } from '@/lib/validation';
import { colors } from '@/ui/theme';

export default function Discover() {
  const [q, setQ] = useState('');
  const [language, setLanguage] = useState<string | undefined>();
  const songs = useQuery({ queryKey: ['songs', q, language], queryFn: () => api.songs({ q: q || undefined, language, limit: 30 }) });

  return (
    <Screen>
      <H1>Discover</H1>
      <Field label="Search songs or artists" value={q} onChangeText={setQ} onEndEditing={() => q && void events.track({ type: 'search', context: { query: q.slice(0, 100) } })} />
      <Row>
        {LANGUAGES.map((l) => (
          <Chip
            key={l}
            label={l}
            selected={language === l}
            onPress={() => {
              setLanguage(language === l ? undefined : l);
              void events.track({ type: 'filter_used', context: { filter: l } });
            }}
          />
        ))}
      </Row>
      {songs.isLoading ? <Skeleton /> : null}
      {songs.error ? <ErrorBanner message="Could not load songs" onRetry={() => void songs.refetch()} /> : null}
      {songs.data?.items.length === 0 ? <Empty title="No songs found" hint="Try a different search." /> : null}
      {songs.data?.items.map((s) => (
        <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/song/[id]', params: { id: s.id } })}>
          <Card>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{s.title}</Text>
            <Muted>
              {s.artist} · {s.language}
            </Muted>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
