import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Chip, Empty, ErrorBanner, Muted, ScreenHeader, Screen, SearchBar, SectionTitle, Skeleton, SongRow } from '@/ui/components';
import { api, events } from '@/lib/client';
import { LANGUAGES } from '@/lib/validation';
import { space } from '@/ui/theme';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Discover() {
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState<string | undefined>();
  const q = useDebounced(input.trim(), 350);
  const songs = useQuery({
    queryKey: ['songs', q, language],
    queryFn: () => api.songs({ q: q || undefined, language, limit: 40 }),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (q.length >= 2) void events.track({ type: 'search', context: { query: q.slice(0, 100) } });
  }, [q]);

  const items = songs.data?.items ?? [];
  const filtered = q.length > 0 || language !== undefined;

  return (
    <Screen refreshing={songs.isRefetching} onRefresh={() => void songs.refetch()}>
      <ScreenHeader title="Discover" subtitle="Search songs or artists, or browse by language." />
      <SearchBar value={input} onChangeText={setInput} placeholder="Search songs or artists" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.md }}>
        <Chip label="All" selected={language === undefined} onPress={() => setLanguage(undefined)} />
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
      </ScrollView>

      <SectionTitle title={filtered ? 'Results' : 'Popular right now'} />
      {songs.isLoading ? (
        <>
          <Skeleton height={76} />
          <Skeleton height={76} />
          <Skeleton height={76} />
        </>
      ) : null}
      {songs.error ? <ErrorBanner message={songs.error instanceof Error ? songs.error.message : 'Could not load songs'} onRetry={() => void songs.refetch()} /> : null}
      {!songs.isLoading && !songs.error && items.length === 0 ? (
        <Empty
          icon={filtered ? 'search-outline' : 'cloud-offline-outline'}
          title={filtered ? 'No songs found' : 'No songs available yet'}
          hint={filtered ? 'Try a different spelling, artist, or language.' : 'The song catalogue is empty. Ask the administrator to load songs.'}
        />
      ) : null}
      {items.length > 0 ? <Muted>{items.length} songs</Muted> : null}
      {items.map((s) => (
        <SongRow
          key={s.id}
          title={s.title}
          artist={s.artist}
          meta={s.language}
          seed={s.title}
          coverUri={s.coverUrl}
          onPress={() => router.push({ pathname: '/song/[id]', params: { id: s.id } })}
        />
      ))}
    </Screen>
  );
}
