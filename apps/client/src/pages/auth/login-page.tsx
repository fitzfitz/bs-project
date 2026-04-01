import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { useAuth } from '@/features/auth/api/use-auth';
import { LoginSchema, type LoginFormValues } from '@/features/auth/types';

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const { login, isLoggingIn, loginError } = useAuth();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    login(data);
  };

  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto bg-slate-50 relative shadow-xl overflow-hidden px-6 pt-20 pb-8">
      
      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl mx-auto mb-6 shadow-lg shadow-primary/30 flex items-center justify-center">
            <span className="text-3xl">💈</span>
          </div>
          <h1 className="text-3xl font-bold font-sans text-slate-900 tracking-tight">Welcome Back</h1>
          <p className="text-slate-500 mt-2">Sign in to book your next cut.</p>
        </div>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            {loginError && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg font-medium border border-red-100">
                {loginError.message || t('loginFailed')}
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
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel>{t('password')}</FormLabel>
                  <FormControl>
                    <Input 
                      {...field}
                      type="password" 
                      placeholder="••••••••"
                      className="h-12 px-4 rounded-xl border border-slate-200 bg-white"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                Forgot Password?
              </Link>
            </div>

            <Button type="submit" disabled={isLoggingIn} size="lg" className="w-full h-12 text-md font-semibold rounded-xl shadow-md mt-4">
              {isLoggingIn ? t('verifying') : t('signIn')}
            </Button>
          </form>
        </Form>

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-600">
          <span>Don't have an account?</span>
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Sign Up
          </Link>
        </div>
      </div>

    </div>
  );
}
