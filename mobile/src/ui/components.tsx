import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { colors, space } from './theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={s.screenBody} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={s.screenBody}>{children}</View>
  );
  return <SafeAreaView style={s.screen}>{body}</SafeAreaView>;
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1}>{children}</Text>;
export const Muted = ({ children }: { children: ReactNode }) => <Text style={s.muted}>{children}</Text>;

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={off}
      onPress={onPress}
      style={[s.btn, variant === 'primary' && s.btnPrimary, variant === 'ghost' && s.btnGhost, variant === 'danger' && s.btnDanger, off && { opacity: 0.5 }]}
    >
      {loading ? <ActivityIndicator color={colors.primaryText} /> : <Text style={[s.btnText, variant === 'ghost' && { color: colors.text }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={[s.input, error ? { borderColor: colors.danger } : null]} accessibilityLabel={label} {...props} />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.chip, selected && s.chipOn]}>
      <Text style={{ color: selected ? colors.primaryText : colors.text }}>{label}</Text>
    </Pressable>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={s.banner} accessibilityRole="alert">
      <Text style={{ color: colors.danger, flex: 1 }}>{message}</Text>
      {onRetry ? <Button label="Retry" variant="ghost" onPress={onRetry} /> : null}
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xl }}>
      <Text style={s.h2}>{title}</Text>
      {hint ? <Muted>{hint}</Muted> : null}
    </View>
  );
}

export function Skeleton({ height = 72 }: { height?: number }) {
  return <View style={{ height, borderRadius: 14, backgroundColor: colors.card, opacity: 0.7 }} />;
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{children}</View>;
}

export const Card = ({ children }: { children: ReactNode }) => <View style={s.card}>{children}</View>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{children}</Text>;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenBody: { padding: space.md, gap: space.md, flexGrow: 1 },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800' },
  h2: { color: colors.text, fontSize: 18, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14 },
  label: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, fontSize: 12 },
  input: { backgroundColor: colors.card, color: colors.text, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14 },
  btn: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  btnPrimary: { backgroundColor: colors.primary },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  btnDanger: { backgroundColor: colors.danger },
  btnText: { color: colors.primaryText, fontWeight: '700', fontSize: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: 12, backgroundColor: '#2A1416' },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.border },
});
