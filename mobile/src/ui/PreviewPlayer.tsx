import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Button } from './components';
import { colors } from './theme';

/**
 * Plays a licensed preview clip supplied by a music provider (never bundled audio).
 * Mounts only while previewing, so at most one native player exists at a time.
 * Reports how long the user actually listened: a learning signal.
 */
export function PreviewPlayer({
  url,
  onStop,
}: {
  url: string;
  onStop: (info: { previewMs: number; completed: boolean }) => void;
}) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  const startedAt = useRef<number | null>(null);
  const reported = useRef(false);

  useEffect(() => {
    player.play();
    startedAt.current = Date.now();
    return () => {
      if (!reported.current && startedAt.current) {
        reported.current = true;
        onStop({ previewMs: Date.now() - startedAt.current, completed: false });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status.didJustFinish && !reported.current && startedAt.current) {
      reported.current = true;
      onStop({ previewMs: Date.now() - startedAt.current, completed: true });
    }
  }, [status.didJustFinish, onStop]);

  return (
    <View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{status.playing ? 'Playing preview…' : 'Preview paused'}</Text>
      <Button label={status.playing ? 'Pause' : 'Play'} variant="ghost" onPress={() => (status.playing ? player.pause() : player.play())} />
    </View>
  );
}
