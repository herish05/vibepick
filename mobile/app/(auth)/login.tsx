import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { Button, ErrorBanner, Field, H1, Muted, Screen } from '@/ui/components';
import { api } from '@/lib/client';
import { loginSchema, type LoginForm } from '@/lib/validation';
import { useSession } from '@/state/session';

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
    <Screen>
      <H1>Welcome back</H1>
      <Muted>Share a story or reel to VibePick and get songs in seconds.</Muted>
      {error ? <ErrorBanner message={error} /> : null}
      <Controller control={control} name="email" render={({ field, fieldState }) => (
        <Field label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
      )} />
      <Controller control={control} name="password" render={({ field, fieldState }) => (
        <Field label="Password" secureTextEntry autoComplete="password" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
      )} />
      <Button label="Log in" onPress={() => void submit()} loading={formState.isSubmitting} />
      <Link href="/(auth)/forgot" style={{ color: '#8B5CF6' }}>Forgot password?</Link>
      <Link href="/(auth)/register" style={{ color: '#8B5CF6' }}>Create an account</Link>
    </Screen>
  );
}
