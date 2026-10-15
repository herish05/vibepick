import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Cover, Icon, IconButton, Pill } from './components';
import { PreviewPlayer } from './PreviewPlayer';
import { colors, space } from './theme';
import { CATEGORY_LABEL, signalReasons } from '@/lib/validation';
import type { RecItem } from '@/lib/types';
import { events } from '@/lib/client';

/** One recommendation with its real explanation, preview, and one-tap selection. */
export function RecommendationCard({
  item,
  recommendationId,
  onSelect,
  selected,
}: {
  item: RecItem;
  recommendationId: string;
  onSelect: (item: RecItem) => void;
  selected?: boolean;
}) {
  const [previewing, setPreviewing] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const reasons = item.reasons.length ? item.reasons : signalReasons(item.why_this_song);
  const base = { songId: item.song_id, recommendationId, position: item.rank };

  return (
    <Card style={[selected ? { borderColor: colors.primary } : null, skipped ? { opacity: 0.5 } : null]}>
      <Pill label={CATEGORY_LABEL[item.category] ?? 'Match'} icon={item.category === 'trending_match' ? 'trending-up' : 'sparkles'} />
      <Pressable
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
        onPress={() => {
          void events.track({ type: 'song_open', ...base });
          router.push({ pathname: '/song/[id]', params: { id: item.song_id } });
        }}
      >
        <Cover seed={item.song.title} size={64} uri={item.song.coverUrl} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }} numberOfLines={2}>
            {item.song.title}
          </Text>
          <Text style={{ color: colors.muted }} numberOfLines={1}>
            {item.song.artist} · {item.song.language}
          </Text>
        </View>
      </Pressable>
      {reasons.length ? (
        <View style={{ gap: 4 }}>
          {reasons.map((r) => (
            <View key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="checkmark-circle" size={14} color={colors.ok} />
              <Text style={{ color: colors.muted, fontSize: 13, flex: 1 }}>{r}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {previewing && item.song.previewUrl ? (
        <PreviewPlayer
          url={item.song.previewUrl}
          onStop={({ previewMs, completed }) => {
            setPreviewing(false);
            void events.track({ type: completed ? 'song_preview_complete' : 'song_preview_start', ...base, context: { previewMs } });
          }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button label={selected ? 'Selected' : 'Use this song'} icon={selected ? 'checkmark' : 'musical-note'} onPress={() => onSelect(item)} />
        </View>
        {item.song.previewUrl ? (
          <IconButton name={previewing ? 'stop' : 'play'} label={previewing ? 'Stop preview' : 'Preview'} onPress={() => setPreviewing((p) => !p)} />
        ) : (
          <IconButton
            name="open-outline"
            label="Find this song online"
            onPress={() => void Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(`${item.song.title} ${item.song.artist}`)}`)}
          />
        )}
        <IconButton
          name="thumbs-down-outline"
          label="Not for me"
          onPress={() => {
            setSkipped(true);
            void events.track({ type: 'song_skipped', ...base });
          }}
        />
      </View>
    </Card>
  );
}
