import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Chip, ErrorBanner, H2, Row, Screen, ScreenHeader, type IconName } from '@/ui/components';
import { api } from '@/lib/client';
import type { FeedbackRating, FeedbackReason } from '@/lib/types';
import { space } from '@/ui/theme';

const RATINGS: { v: FeedbackRating; label: string; icon: IconName }[] = [
  { v: 'exactly', label: 'Exactly my vibe', icon: 'flame' },
  { v: 'good', label: 'Good', icon: 'thumbs-up' },
  { v: 'okay', label: 'Okay', icon: 'remove-circle-outline' },
  { v: 'not_my_vibe', label: 'Not my vibe', icon: 'thumbs-down' },
];
const REASONS: { v: FeedbackReason; label: string }[] = [
  { v: 'wrong_mood', label: 'Wrong mood' },
  { v: 'wrong_language', label: 'Wrong language' },
  { v: 'too_common', label: 'Too common' },
  { v: 'too_slow', label: 'Too slow' },
  { v: 'too_energetic', label: 'Too energetic' },
  { v: 'dislike_artist', label: 'Not into this artist' },
  { v: 'doesnt_match_photo', label: "Doesn't match my content" },
  { v: 'not_trending', label: 'Not trending enough' },
];

export default function Feedback() {
  const { recId, songId } = useLocalSearchParams<{ recId: string; songId?: string }>();
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [reasons, setReasons] = useState<FeedbackReason[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!rating || !recId) return;
    setBusy(true);
    try {
      await api.sendFeedback({ recommendationId: recId, songId, rating, reasons });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send');
      setBusy(false);
    }
  }

  return (
    <Screen bottomInset>
      <ScreenHeader title="How did we do?" subtitle="Your answer teaches VibePick your taste." />
      {error ? <ErrorBanner message={error} /> : null}
      <Row>
        {RATINGS.map((r) => (
          <Chip key={r.v} label={r.label} icon={r.icon} selected={rating === r.v} onPress={() => setRating(r.v)} />
        ))}
      </Row>
      {rating === 'not_my_vibe' || rating === 'okay' ? (
        <View style={{ gap: space.sm }}>
          <H2>What was off?</H2>
          <Row>
            {REASONS.map((r) => (
              <Chip key={r.v} label={r.label} selected={reasons.includes(r.v)} onPress={() => setReasons((x) => (x.includes(r.v) ? x.filter((y) => y !== r.v) : [...x, r.v]))} />
            ))}
          </Row>
        </View>
      ) : null}
      <Button label="Send feedback" icon="send" onPress={() => void submit()} disabled={!rating} loading={busy} />
      <Button label="Skip" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
