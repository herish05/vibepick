import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Chip, ErrorBanner, H1, H2, Row, Screen } from '@/ui/components';
import { api } from '@/lib/client';
import type { FeedbackRating, FeedbackReason } from '@/lib/types';

const RATINGS: { v: FeedbackRating; label: string }[] = [
  { v: 'exactly', label: 'Exactly my vibe' },
  { v: 'good', label: 'Good' },
  { v: 'okay', label: 'Okay' },
  { v: 'not_my_vibe', label: 'Not my vibe' },
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
    <Screen>
      <H1>How did we do?</H1>
      {error ? <ErrorBanner message={error} /> : null}
      <Row>{RATINGS.map((r) => <Chip key={r.v} label={r.label} selected={rating === r.v} onPress={() => setRating(r.v)} />)}</Row>
      {rating === 'not_my_vibe' || rating === 'okay' ? (
        <>
          <H2>What was off?</H2>
          <Row>{REASONS.map((r) => <Chip key={r.v} label={r.label} selected={reasons.includes(r.v)} onPress={() => setReasons((x) => (x.includes(r.v) ? x.filter((y) => y !== r.v) : [...x, r.v]))} />)}</Row>
        </>
      ) : null}
      <Button label="Send feedback" onPress={() => void submit()} disabled={!rating} loading={busy} />
      <Button label="Skip" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
