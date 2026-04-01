import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { api, type ApiResponse } from '@/lib/api';
import { useState } from 'react';

const ForgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
});

type ForgotPasswordFormValues = z.infer<typeof ForgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth');
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    try {
      await api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', { email: data.email });
      setSubmitted(true);
    } catch (err) {
      form.setError('root', { message: (err as Error).message || 'Something went wrong.' });
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col min-h-dvh max-w-md mx-auto bg-slate-50 px-6 pt-20 pb-8">
        <div className="flex-1 flex flex-col justify-center text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <span className="text-3xl">✉️</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t('checkEmailTitle')}</h1>
          <p className="text-slate-500 mt-2">
            {t('resetSent')}
          </p>
          <Button asChild className="mt-8" size="lg">
            <Link to="/login">{t('backToSignIn')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto bg-slate-50 px-6 pt-20 pb-8">
      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl mx-auto mb-6 shadow-lg shadow-primary/30 flex items-center justify-center">
            <span className="text-3xl">🔑</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('forgotPassword')}</h1>
          <p className="text-slate-500 mt-2">{t('forgotSubtitle')}</p>
        </div>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            {form.formState.errors.root && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {form.formState.errors.root.message}
              </div>
            )}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="you@example.com"
                      className="h-12 px-4 rounded-xl border border-slate-200 bg-white"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting} size="lg" className="w-full h-12 rounded-xl mt-4">
              {form.formState.isSubmitting ? t('sending') : t('sendResetLink')}
            </Button>
          </form>
        </Form>

        <p className="text-center mt-6 text-sm text-slate-500">
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t('backToSignIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
