import { useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { AuthHero, Button, Divider, ErrorBanner, Field, Screen } from '@/ui/components';
import { api } from '@/lib/client';
import { registerSchema, type RegisterForm } from '@/lib/validation';
import { useSession } from '@/state/session';
import { space } from '@/ui/theme';

export default function Register() {
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirm: '' },
  });
  const setSignedIn = useSession((s) => s.setSignedIn);

  const submit = handleSubmit(async (v) => {
    setError(null);
    try {
      await api.register(v.email, v.password);
      setSignedIn(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create account');
    }
  });

  return (
    <Screen bottomInset>
      <AuthHero title="Create your account" subtitle="No Instagram needed. Connect it later, or never." />
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
              placeholder="At least 8 characters"
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="confirm"
          render={({ field, fieldState }) => (
            <Field
              label="Confirm password"
              icon="shield-checkmark-outline"
              placeholder="Repeat your password"
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              onSubmitEditing={() => void submit()}
              error={fieldState.error?.message}
            />
          )}
        />
        <Button label="Create account" onPress={() => void submit()} loading={formState.isSubmitting} />
      </View>
      <Divider label="Already have an account?" />
      <Button label="Log in" variant="ghost" onPress={() => router.replace('/(auth)/login')} />
    </Screen>
  );
}
