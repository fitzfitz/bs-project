import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/lib/api';
import { useSessionStore } from '@/features/auth/store';
import type { LoginResponse, RegisterResponse } from '../types';

type LoginRequest = { email: string; password: string; };
type RegisterRequest = { email: string; password: string; firstName: string; lastName: string; phone?: string; };

export function useAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useSessionStore((state) => state.setSession);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginRequest) =>
      api.post<LoginResponse>('/auth/login', credentials),
    onSuccess: (data) => {
      setSession(
        { 
          id: data.data.user.id, 
          tenantRoleId: data.data.user.tenantRoleId,
          tenantRole: data.data.user.tenantRole,
          isCustomer: data.data.user.isCustomer,
          email: data.data.user.email,
          firstName: data.data.user.firstName,
          lastName: data.data.user.lastName
        },
        data.data.accessToken,
        data.data.refreshToken
      );
      navigate(from, { replace: true });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (payload: RegisterRequest) =>
      api.post<RegisterResponse>('/auth/register', payload),
    onSuccess: () => {
      navigate('/login');
    },
  });

  return {
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
  };
}
