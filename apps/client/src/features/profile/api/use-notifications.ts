import { useContext } from 'react';
import { NotificationContext } from '@/components/providers/NotificationProvider';

export const useNotifications = () => useContext(NotificationContext);
