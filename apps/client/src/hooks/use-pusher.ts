import { useEffect, useRef } from "react";
import Pusher from "pusher-js";
import { useQueryClient } from "@tanstack/react-query";

const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY ?? "";
const PUSHER_HOST = import.meta.env.VITE_PUSHER_HOST ?? "localhost";
const PUSHER_PORT = Number(import.meta.env.VITE_PUSHER_PORT ?? 6001);
const PUSHER_USE_TLS = import.meta.env.VITE_PUSHER_USE_TLS === "true";

let pusherInstance: Pusher | null = null;

function getPusher(): Pusher | null {
  if (!PUSHER_KEY) return null;
  if (!pusherInstance) {
    pusherInstance = new Pusher(PUSHER_KEY, {
      wsHost: PUSHER_HOST,
      wsPort: PUSHER_PORT,
      wssPort: PUSHER_PORT,
      forceTLS: PUSHER_USE_TLS,
      enabledTransports: ["ws", "wss"],
      cluster: "mt1",
    });
  }
  return pusherInstance;
}

/**
 * Subscribe to a Pusher/Soketi channel and invalidate TanStack Query keys on events.
 */
export function usePusherChannel(
  channelName: string | null,
  eventName: string,
  queryKeys: unknown[][],
) {
  const qc = useQueryClient();
  const subscribedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!channelName) return;
    const pusher = getPusher();
    if (!pusher) return;

    if (subscribedRef.current !== channelName) {
      if (subscribedRef.current) {
        pusher.unsubscribe(subscribedRef.current);
      }
      subscribedRef.current = channelName;
    }

    const channel = pusher.subscribe(channelName);

    const handler = () => {
      for (const key of queryKeys) {
        qc.invalidateQueries({ queryKey: key });
      }
    };

    channel.bind(eventName, handler);

    return () => {
      channel.unbind(eventName, handler);
      pusher.unsubscribe(channelName);
      subscribedRef.current = null;
    };
  }, [channelName, eventName, qc, queryKeys]);
}
