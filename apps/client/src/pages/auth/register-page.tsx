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
import { RegisterSchema, type RegisterFormValues } from '@/features/auth/types';

export default function RegisterPage() {
  const { t } = useTranslation('auth');
  const { register, isRegistering, registerError } = useAuth();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
    },
  });

  const onSubmit = (data: RegisterFormValues) => {
    register(data);
  };

  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto bg-slate-50 relative shadow-xl overflow-hidden px-6 pt-12 pb-8">
      
      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold font-sans text-slate-900 tracking-tight">{t('register')}</h1>
          <p className="text-slate-500 mt-2">{t('registerSubtitle')}</p>
        </div>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            {registerError && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg font-medium border border-red-100">
                {registerError.message || t('registerFailed')}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="text" 
                        placeholder="John"
                        className="h-12 px-4 rounded-xl border border-slate-200 bg-white"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel>{t('lastName')}</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="text" 
                        placeholder="Doe"
                        className="h-12 px-4 rounded-xl border border-slate-200 bg-white"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
              name="phone"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel>{t('phoneOptional')}</FormLabel>
                  <FormControl>
                    <Input 
                      {...field}
                      type="tel" 
                      placeholder="+62 8..."
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
                  <FormLabel>Password</FormLabel>
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

            <Button type="submit" disabled={isRegistering} size="lg" className="w-full h-12 text-md font-semibold rounded-xl shadow-md mt-6">
              {isRegistering ? t('creatingAccount') : t('signUp')}
            </Button>
          </form>
        </Form>

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-600">
          <span>{t('haveAccount')}</span>
          <Link to="/login" className="font-semibold text-primary hover:underline">
            {t('signIn')}
          </Link>
        </div>
      </div>

    </div>
  );
}
