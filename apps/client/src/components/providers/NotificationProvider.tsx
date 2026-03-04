import { createContext, useEffect, useState, type ReactNode } from 'react';
import OneSignal from 'react-onesignal';
import { useSessionStore } from '@/features/auth/store';

interface NotificationContextValue {
  isInitialized: boolean;
  isPushEnabled: boolean;
  promptPushOption: () => Promise<void>;
  enablePush: (enable: boolean) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  isInitialized: false,
  isPushEnabled: false,
  promptPushOption: async () => {},
  enablePush: async () => {},
});

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '00000000-0000-0000-0000-000000000000'; // Stub ID

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const { user } = useSessionStore();

  useEffect(() => {
    const initOneSignal = async () => {
      try {
        if (!isInitialized) {
          await OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            allowLocalhostAsSecureOrigin: true,
          });
          setIsInitialized(true);
        }
        
        const hasOptedIn = OneSignal.Notifications.permission;
        setIsPushEnabled(!!hasOptedIn);

      } catch (e) {
        console.warn('OneSignal initialization failed or blocked:', e);
      }
    };

    if (ONESIGNAL_APP_ID) {
      initOneSignal();
    }
    // Intentionally run only on mount; isInitialized is set inside and would cause re-run if in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once on mount
  }, []);

  // Bind OneSignal External User ID to backend User ID when logged in
  useEffect(() => {
    if (isInitialized && user) {
      OneSignal.login(user.id).catch(console.warn);
    } else if (isInitialized && !user) {
      OneSignal.logout().catch(console.warn);
    }
  }, [isInitialized, user]);

  const promptPushOption = async () => {
    if (!isInitialized) return;
    try {
      await OneSignal.Notifications.requestPermission();
      setIsPushEnabled(!!OneSignal.Notifications.permission);
    } catch (e) {
      console.error("Error requesting push permission", e);
    }
  };

  const enablePush = async (enable: boolean) => {
    if (!isInitialized) return;
    // Note: Once granted at browser level, we can't truly 'disable' without OS settings,
    // but OneSignal can opt them out at the SDK level if supported by SDK standard.
    // For V1 MVP, we just prompt if trying to enable.
    if (enable) {
      await promptPushOption();
    } else {
      // In production, you might tag user as opted-out or disable push via SDK if available.
      // OneSignal.User.PushSubscription.optOut();
      setIsPushEnabled(false);
    }
  };

  return (
    <NotificationContext.Provider value={{ isInitialized, isPushEnabled, promptPushOption, enablePush }}>
      {children}
    </NotificationContext.Provider>
  );
}

export { NotificationContext };
