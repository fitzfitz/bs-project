import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CreateBookingInput } from '../types';

export function useCreateBooking() {
  return useMutation({
    mutationFn: async (input: CreateBookingInput) => {
      return api.post<unknown>('/queue', input);
    },
  });
}
