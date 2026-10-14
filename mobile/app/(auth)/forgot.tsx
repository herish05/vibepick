import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { Button, Field, H1, Muted, Screen } from '@/ui/components';
import { api } from '@/lib/client';
import { forgotSchema } from '@/lib/validation';

export default function Forgot() {
  const [sent, setSent] = useState(false);
  const { control, handleSubmit, formState } = useForm<{ email: string }>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });
  const submit = handleSubmit(async (v) => {
    await api.forgotPassword(v.email).catch(() => undefined);
    setSent(true); // Same message whether or not the account exists.
  });
  return (
    <Screen>
      <H1>Reset password</H1>
      {sent ? (
        <Muted>If that email has an account, reset instructions are on their way.</Muted>
      ) : (
        <>
          <Controller control={control} name="email" render={({ field, fieldState }) => (
            <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Button label="Send reset link" onPress={() => void submit()} loading={formState.isSubmitting} />
        </>
      )}
      <Link href="/(auth)/login" style={{ color: '#8B5CF6' }}>Back to login</Link>
    </Screen>
  );
}
