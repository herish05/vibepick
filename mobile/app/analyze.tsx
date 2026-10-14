import { useEffect, useRef, useState } from 'react';
import { Image, Text } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Chip, ErrorBanner, Field, H1, H2, Muted, Row, Screen } from '@/ui/components';
import { api } from '@/lib/client';
import { useSession } from '@/state/session';
import { LANGUAGES, MOODS, OCCASIONS, TARGET_LABEL } from '@/lib/validation';
import type { ContentTarget, UploadedMedia } from '@/lib/types';
import { colors } from '@/ui/theme';

const TARGETS: ContentTarget[] = ['instagram_story', 'instagram_reel', 'instagram_post', 'whatsapp_status', 'youtube_short'];
const sessionId = () => Math.random().toString(36).slice(2, 12);

/**
 * Receive -> Understand -> Recommend. Analysis starts the instant content arrives;
 * the context chips below are optional and can be tapped while it runs.
 */
export default function Analyze() {
  const pending = useSession((s) => s.pending);
  const setPending = useSession((s) => s.setPending);
  const setRecommendationId = useSession((s) => s.setRecommendationId);

  const [media, setMedia] = useState<UploadedMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [target, setTarget] = useState<ContentTarget>(pending && pending.kind !== 'text' ? pending.contentTarget : 'instagram_story');
  const [occasion, setOccasion] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const [nl, setNl] = useState(pending?.kind === 'text' ? pending.text : '');
  const started = useRef(false);
  const session = useRef(sessionId());

  const upload = async () => {
    if (pending?.kind !== 'media') return;
    setError(null);
    try {
      setMedia(await api.uploadMedia({ uri: pending.uri, name: pending.name, mimeType: pending.mimeType }, { contentTarget: target, origin: pending.origin, receivedAt: pending.receivedAt }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  useEffect(() => {
    if (!pending) return router.replace('/');
    if (pending.kind === 'media' && !started.current) {
      started.current = true;
      void upload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function find() {
    if (!pending) return;
    setFinding(true);
    setError(null);
    try {
      const rec = await api.recommend({
        media_id: media?.id,
        content_type: target,
        occasion,
        mood,
        language_preferences: languages.map((l) => l.toLowerCase()),
        natural_language_context: nl.trim() || null,
        session_id: session.current,
      });
      setRecommendationId(rec.recommendation_id);
      setPending(null);
      router.replace({ pathname: '/results', params: { id: rec.recommendation_id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get songs');
      setFinding(false);
    }
  }

  function close() {
    setPending(null);
    router.back();
  }

  if (!pending) return null;
  const analysing = pending.kind === 'media' && !media && !error;
  const canFind = pending.kind === 'text' ? nl.trim().length >= 3 : pending.kind === 'media' && media !== null;

  return (
    <Screen>
      <H1>Understanding your content</H1>
      {error ? <ErrorBanner message={error} onRetry={pending.kind === 'media' && !media ? () => void upload() : undefined} /> : null}

      {pending.kind === 'media' ? (
        <Card>
          {!pending.isVideo ? <Image source={{ uri: pending.uri }} style={{ height: 220, borderRadius: 12 }} resizeMode="cover" accessibilityLabel="Your shared photo" /> : <Muted>Video ready</Muted>}
          <Text style={{ color: colors.muted }}>
            {analysing ? 'Analysing the vibe…' : media ? `Vibe: ${Object.entries(media.analysis.vibe).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k).join(', ') || 'neutral'}` : ''}
          </Text>
          {media && media.analysis.confidence < 0.5 ? <Muted>Low visual confidence. Add a mood or describe it below for sharper results.</Muted> : null}
        </Card>
      ) : null}

      {pending.kind === 'link' ? (
        <Card>
          <H2>That is a link</H2>
          <Muted>VibePick never opens or scrapes links. Share the photo or video itself from your gallery, or describe it below.</Muted>
        </Card>
      ) : null}

      <H2>Posting as</H2>
      <Row>{TARGETS.map((t) => <Chip key={t} label={TARGET_LABEL[t] ?? t} selected={target === t} onPress={() => setTarget(t)} />)}</Row>
      <H2>Occasion (optional)</H2>
      <Row>{OCCASIONS.map((o) => <Chip key={o} label={o} selected={occasion === o} onPress={() => setOccasion(occasion === o ? null : o)} />)}</Row>
      <H2>Mood (optional)</H2>
      <Row>{MOODS.map((m) => <Chip key={m} label={m} selected={mood === m} onPress={() => setMood(mood === m ? null : m)} />)}</Row>
      <H2>Language (optional)</H2>
      <Row>{LANGUAGES.map((l) => <Chip key={l} label={l} selected={languages.includes(l)} onPress={() => setLanguages((x) => (x.includes(l) ? x.filter((v) => v !== l) : [...x, l]))} />)}</Row>
      <Field label="Or say it your way" placeholder="Punjabi, not too popular" value={nl} onChangeText={setNl} maxLength={300} />

      <Button label={analysing ? 'Analysing…' : 'Find songs'} onPress={() => void find()} disabled={!canFind || analysing} loading={finding} />
      <Button label="Cancel" variant="ghost" onPress={close} />
    </Screen>
  );
}
