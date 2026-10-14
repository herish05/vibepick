import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { Button, ErrorBanner, Field, H1, Muted, Screen } from '@/ui/components';
import { api } from '@/lib/client';
import { registerSchema, type RegisterForm } from '@/lib/validation';
import { useSession } from '@/state/session';

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
    <Screen>
      <H1>Create your account</H1>
      <Muted>No Instagram needed. You can connect it later, or never.</Muted>
      {error ? <ErrorBanner message={error} /> : null}
      <Controller control={control} name="email" render={({ field, fieldState }) => (
        <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
      )} />
      <Controller control={control} name="password" render={({ field, fieldState }) => (
        <Field label="Password" secureTextEntry value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
      )} />
      <Controller control={control} name="confirm" render={({ field, fieldState }) => (
        <Field label="Confirm password" secureTextEntry value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
      )} />
      <Button label="Sign up" onPress={() => void submit()} loading={formState.isSubmitting} />
      <Link href="/(auth)/login" style={{ color: '#8B5CF6' }}>I already have an account</Link>
    </Screen>
  );
}
