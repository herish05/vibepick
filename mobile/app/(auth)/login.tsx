import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { AuthHero, Button, Divider, ErrorBanner, Field, Screen } from '@/ui/components';
import { api } from '@/lib/client';
import { loginSchema, type LoginForm } from '@/lib/validation';
import { useSession } from '@/state/session';
import { colors, space } from '@/ui/theme';

export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const setSignedIn = useSession((s) => s.setSignedIn);

  const submit = handleSubmit(async (v) => {
    setError(null);
    try {
      await api.login(v.email, v.password);
      setSignedIn((await api.me()).onboarded);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    }
  });

  return (
    <Screen bottomInset>
      <AuthHero title="Welcome back" subtitle="Share a story or reel and get the perfect song in seconds." />
      <View style={{ gap: space.md }}>
        {error ? <ErrorBanner message={error} /> : null}
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field
              label="Email"
              icon="mail-outline"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <Field
              label="Password"
              icon="lock-closed-outline"
              placeholder="Your password"
              secureTextEntry
              autoComplete="password"
              value={field.value}
              onChangeText={field.onChange}
              onSubmitEditing={() => void submit()}
              error={fieldState.error?.message}
            />
          )}
        />
        <Pressable accessibilityRole="link" onPress={() => router.push('/(auth)/forgot')} style={{ alignSelf: 'flex-end' }} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Forgot password?</Text>
        </Pressable>
        <Button label="Log in" onPress={() => void submit()} loading={formState.isSubmitting} />
      </View>
      <Divider label="New to VibePick?" />
      <Button label="Create an account" variant="ghost" onPress={() => router.push('/(auth)/register')} />
    </Screen>
  );
}
