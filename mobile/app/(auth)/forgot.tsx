import { useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { AuthHero, Button, Card, Empty, Field, Muted, Screen } from '@/ui/components';
import { api } from '@/lib/client';
import { forgotSchema } from '@/lib/validation';
import { space } from '@/ui/theme';

export default function Forgot() {
  const [sent, setSent] = useState(false);
  const { control, handleSubmit, formState } = useForm<{ email: string }>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });
  const submit = handleSubmit(async (v) => {
    await api.forgotPassword(v.email).catch(() => undefined);
    setSent(true); // Same message whether or not the account exists.
  });
  return (
    <Screen bottomInset>
      <AuthHero title="Reset password" subtitle="Enter your email and we will send you a link to get back in." />
      {sent ? (
        <Card>
          <Empty icon="mail-open-outline" title="Check your inbox" hint="If that email has an account, reset instructions are on their way." />
        </Card>
      ) : (
        <View style={{ gap: space.md }}>
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
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Button label="Send reset link" onPress={() => void submit()} loading={formState.isSubmitting} />
          <Muted>Emails can take a few minutes to arrive.</Muted>
        </View>
      )}
      <Button label="Back to log in" variant="ghost" icon="arrow-back" onPress={() => router.replace('/(auth)/login')} />
    </Screen>
  );
}
