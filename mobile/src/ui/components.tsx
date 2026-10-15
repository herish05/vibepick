import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, coverColors, gradients, radius, space } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

/* ---------- Layout ---------- */

export function Screen({
  children,
  scroll = true,
  bottomInset = false,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Add the system navigation-bar inset (screens that are not inside the tab bar). */
  bottomInset?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const pad = { paddingBottom: space.xl + (bottomInset ? insets.bottom : 0) };
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[s.screenBody, pad]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[s.screenBody, pad, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <LinearGradient colors={gradients.glow} style={s.glow} pointerEvents="none" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1}>{children}</Text>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{children}</Text>;
export const Muted = ({ children }: { children: ReactNode }) => <Text style={s.muted}>{children}</Text>;

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <View style={s.headerRow}>
        {onBack ? <IconButton name="chevron-back" label="Back" onPress={onBack} /> : null}
        <Text style={[s.h1, { flex: 1 }]} numberOfLines={1}>
          {title}
        </Text>
        {right}
      </View>
      {subtitle ? <Text style={s.muted}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** Brand-gradient surface for hero blocks. */
export function GradientCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.gradientCard, style]}>
      {children}
    </LinearGradient>
  );
}

/* ---------- Controls ---------- */

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'soft' | 'light';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  const off = disabled || loading;
  const textColor = variant === 'light' ? '#1B1033' : variant === 'ghost' || variant === 'soft' ? colors.text : colors.primaryText;
  const content = loading ? (
    <ActivityIndicator color={textColor} />
  ) : (
    <View style={s.btnInner}>
      {icon ? <Icon name={icon} size={19} color={variant === 'soft' ? colors.primary : textColor} /> : null}
      <Text style={[s.btnText, { color: textColor }]}>{label}</Text>
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(off) }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        variant === 'ghost' && s.btnGhost,
        variant === 'soft' && s.btnSoft,
        variant === 'light' && { backgroundColor: '#FFFFFF' },
        variant === 'danger' && s.btnDanger,
        off && { opacity: 0.45 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnFill}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

export function IconButton({ name, onPress, label, tint = colors.text }: { name: IconName; onPress: () => void; label: string; tint?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
    >
      <Icon name={name} size={20} color={tint} />
    </Pressable>
  );
}

export function Field({ label, error, icon, secureTextEntry, ...props }: TextInputProps & { label: string; error?: string; icon?: IconName }) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrap, focused && { borderColor: colors.primary }, error ? { borderColor: colors.danger } : null]}>
        {icon ? <Icon name={icon} size={18} color={focused ? colors.primary : colors.faint} /> : null}
        <TextInput
          placeholderTextColor={colors.faint}
          selectionColor={colors.primary}
          style={s.input}
          accessibilityLabel={label}
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.faint} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function SearchBar({ value, onChangeText, placeholder, onSubmit }: { value: string; onChangeText: (t: string) => void; placeholder: string; onSubmit?: () => void }) {
  return (
    <View style={s.searchWrap}>
      <Icon name="search" size={18} color={colors.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        selectionColor={colors.primary}
        returnKeyType="search"
        autoCorrect={false}
        style={s.input}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
          <Icon name="close-circle" size={18} color={colors.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [s.chip, selected && s.chipOn, pressed && { opacity: 0.8 }]}
    >
      {icon ? <Icon name={icon} size={15} color={selected ? colors.primary : colors.muted} /> : null}
      <Text style={{ color: selected ? colors.text : colors.muted, fontWeight: selected ? '700' : '500', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, tone = 'brand', icon }: { label: string; tone?: 'brand' | 'ok' | 'muted'; icon?: IconName }) {
  const bg = tone === 'ok' ? colors.okSoft : tone === 'muted' ? colors.surface2 : colors.primarySoft;
  const fg = tone === 'ok' ? colors.ok : tone === 'muted' ? colors.muted : '#C4B5FD';
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

/* ---------- Feedback states ---------- */

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={s.banner} accessibilityRole="alert">
      <Icon name="alert-circle" size={20} color={colors.danger} />
      <Text style={{ color: colors.danger, flex: 1, lineHeight: 20 }}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry" hitSlop={8}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Empty({ title, hint, icon = 'musical-notes-outline' }: { title: string; hint?: string; icon?: IconName }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Icon name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={[s.h2, { textAlign: 'center' }]}>{title}</Text>
      {hint ? <Text style={[s.muted, { textAlign: 'center' }]}>{hint}</Text> : null}
    </View>
  );
}

export function Skeleton({ height = 72 }: { height?: number }) {
  const o = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View style={{ height, borderRadius: radius.lg, backgroundColor: colors.card, opacity: o }} />;
}

/* ---------- Music ---------- */

export function Cover({ seed, size = 52, uri }: { seed: string; size?: number; uri?: string | null }) {
  const [a, b] = coverColors(seed);
  return (
    <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size * 0.26, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Icon name="musical-notes" size={size * 0.46} color="rgba(255,255,255,0.88)" />
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} /> : null}
    </LinearGradient>
  );
}

export function SongRow({
  title,
  artist,
  meta,
  seed,
  coverUri,
  onPress,
  trailing,
}: {
  title: string;
  artist: string;
  meta?: string;
  seed: string;
  coverUri?: string | null;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} by ${artist}`}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.songRow, pressed && { backgroundColor: colors.surface2 }]}
    >
      <Cover seed={seed} uri={coverUri} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.songTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={s.songArtist} numberOfLines={1}>
          {artist}
        </Text>
        {meta ? (
          <Text style={s.songMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron-forward" size={18} color={colors.faint} /> : null)}
    </Pressable>
  );
}

/* ---------- Brand ---------- */

export function BrandMark({ size = 72 }: { size?: number }) {
  return (
    <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="musical-notes" size={size * 0.52} color="#FFFFFF" />
    </LinearGradient>
  );
}

/** Centered hero used by the sign-in / sign-up / reset screens. */
export function AuthHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ alignItems: 'center', gap: space.sm, paddingTop: space.lg, paddingBottom: space.md }}>
      <BrandMark />
      <Text style={s.brand}>VibePick</Text>
      <Text style={[s.h1, { textAlign: 'center', marginTop: space.md }]}>{title}</Text>
      <Text style={[s.muted, { textAlign: 'center', maxWidth: 300 }]}>{subtitle}</Text>
    </View>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <View style={s.line} />
      <Text style={{ color: colors.faint, fontSize: 12 }}>{label}</Text>
      <View style={s.line} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 280 },
  screenBody: { padding: space.md, gap: space.md, flexGrow: 1 },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  h2: { color: colors.text, fontSize: 18, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  brand: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 12 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  btn: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btnFill: { alignSelf: 'stretch', minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.md },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
  btnSoft: { backgroundColor: colors.primarySoft },
  btnDanger: { backgroundColor: colors.danger },
  btnText: { fontWeight: '700', fontSize: 16 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl, paddingHorizontal: space.md },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.border },
  gradientCard: { borderRadius: radius.xl, padding: space.lg, gap: space.sm },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 10, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  songTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  songArtist: { color: colors.muted, fontSize: 14 },
  songMeta: { color: colors.faint, fontSize: 12 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
