import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Button, Card, Chip, ErrorBanner, Field, H1, H2, Muted, Row, Screen } from '@/ui/components';
import { api } from '@/lib/client';
import { LANGUAGES, VIBES } from '@/lib/validation';
import { useSession } from '@/state/session';
import { colors } from '@/ui/theme';

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export default function Onboarding() {
  const [languages, setLanguages] = useState<string[]>([]);
  const [vibes, setVibes] = useState<string[]>([]);
  const [artists, setArtists] = useState('');
  const [allowMlUse, setAllowMlUse] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setOnboarded = useSession((s) => s.setOnboarded);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await api.setPreferences({
        languages,
        vibes,
        favoriteArtists: artists.split(',').map((a) => a.trim()).filter(Boolean).slice(0, 20),
        allowMlUse,
      });
      setOnboarded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <H1>Tune VibePick to you</H1>
      <Muted>30 seconds, all optional. This only seeds your taste; it keeps learning from what you pick.</Muted>
      {error ? <ErrorBanner message={error} /> : null}
      <H2>Languages you use in content</H2>
      <Row>{LANGUAGES.map((l) => <Chip key={l} label={l} selected={languages.includes(l)} onPress={() => setLanguages((x) => toggle(x, l))} />)}</Row>
      <H2>Your vibes</H2>
      <Row>{VIBES.map((v) => <Chip key={v} label={v} selected={vibes.includes(v)} onPress={() => setVibes((x) => toggle(x, v))} />)}</Row>
      <Field label="Favourite artists (comma separated)" value={artists} onChangeText={setArtists} placeholder="Arijit Singh, Diljit Dosanjh" />
      <Card>
        <H2>Instagram (optional)</H2>
        <Muted>
          VibePick works without it. Share content to the app from Instagram or your gallery. You can connect Instagram later in Profile, through Instagram's official login. We never ask for your Instagram password.
        </Muted>
      </Card>
      <Card>
        <H2>Privacy</H2>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ color: colors.text, flex: 1 }}>Use my content only to pick songs and improve my recommendations</Text>
          <Switch accessibilityLabel="Allow ML use" value={allowMlUse} onValueChange={setAllowMlUse} />
        </View>
        <Muted>Uploads are deleted automatically after a short retention period. You can delete everything anytime in Profile.</Muted>
      </Card>
      <Button label="Start picking songs" onPress={() => void finish()} loading={saving} />
    </Screen>
  );
}
