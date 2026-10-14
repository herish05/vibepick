import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Row } from './components';
import { PreviewPlayer } from './PreviewPlayer';
import { colors } from './theme';
import { CATEGORY_LABEL, signalReasons } from '@/lib/validation';
import type { RecItem } from '@/lib/types';
import { events } from '@/lib/client';

/** One recommendation with its real explanation, preview, and one-tap selection. */
export function RecommendationCard({
  item,
  recommendationId,
  onSelect,
}: {
  item: RecItem;
  recommendationId: string;
  onSelect: (item: RecItem) => void;
}) {
  const [previewing, setPreviewing] = useState(false);
  const reasons = item.reasons.length ? item.reasons : signalReasons(item.why_this_song);
  const base = { songId: item.song_id, recommendationId, position: item.rank };

  return (
    <Card>
      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{CATEGORY_LABEL[item.category] ?? 'Match'}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void events.track({ type: 'song_open', ...base });
          router.push({ pathname: '/song/[id]', params: { id: item.song_id } });
        }}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{item.song.title}</Text>
        <Text style={{ color: colors.muted }}>
          {item.song.artist} · {item.song.language}
        </Text>
      </Pressable>
      {reasons.map((r) => (
        <Text key={r} style={{ color: colors.muted, fontSize: 13 }}>
          • {r}
        </Text>
      ))}
      {previewing && item.song.previewUrl ? (
        <PreviewPlayer
          url={item.song.previewUrl}
          onStop={({ previewMs, completed }) => {
            setPreviewing(false);
            void events.track({ type: completed ? 'song_preview_complete' : 'song_preview_start', ...base, context: { previewMs } });
          }}
        />
      ) : null}
      <Row>
        <View style={{ flex: 1, minWidth: 120 }}>
          <Button label="Use this song" onPress={() => onSelect(item)} />
        </View>
        {item.song.previewUrl ? (
          <View style={{ minWidth: 100 }}>
            <Button label={previewing ? 'Stop' : 'Preview'} variant="ghost" onPress={() => setPreviewing((p) => !p)} />
          </View>
        ) : (
          <View style={{ minWidth: 100 }}>
            <Button
              label="Find"
              variant="ghost"
              onPress={() =>
                void Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(`${item.song.title} ${item.song.artist}`)}`)
              }
            />
          </View>
        )}
      </Row>
      <Pressable accessibilityRole="button" onPress={() => void events.track({ type: 'song_skipped', ...base })}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Not for me</Text>
      </Pressable>
    </Card>
  );
}
