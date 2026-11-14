"use client";

import * as React from "react";

export type RealtimeConfig = { key: string; host: string; port: number; scheme: "http" | "https" };
type Listener = (payload: unknown) => void;
type Channel = { listen: (event: string, cb: Listener) => Channel; stopListening: (event: string, cb?: Listener) => Channel };
type EchoLike = { private: (name: string) => Channel; leave: (name: string) => void; disconnect: () => void; connector: { pusher: { connection: { bind: (event: string, cb: () => void) => void } } } };

const Context = React.createContext<{ echo: EchoLike | null; reconnects: number }>({ echo: null, reconnects: 0 });

/**
 * One WebSocket connection to our Reverb server for the dashboard (or the admin). Private
 * channels are authorised through the BFF with the session cookie. Without a config (realtime off)
 * nothing connects and screens simply load their data on open.
 */
export function RealtimeProvider({ config, children }: { config: RealtimeConfig | null; children: React.ReactNode }) {
  const [echo, setEcho] = React.useState<EchoLike | null>(null);
  const [reconnects, setReconnects] = React.useState(0);

  React.useEffect(() => {
    if (!config) return;
    let instance: EchoLike | null = null;
    let cancelled = false;
    void (async () => {
      const [{ default: Echo }, { default: Pusher }] = await Promise.all([import("laravel-echo"), import("pusher-js")]);
      if (cancelled) return;
      instance = new Echo({
        broadcaster: "reverb",
        key: config.key,
        wsHost: config.host || window.location.hostname,
        wsPort: config.port,
        wssPort: config.port,
        forceTLS: config.scheme === "https",
        enabledTransports: ["ws", "wss"],
        authEndpoint: "/api/bff/broadcasting/auth",
        Pusher,
      }) as unknown as EchoLike;
      let connectedOnce = false;
      // After a lost connection, screens reload what they show (messages sent meanwhile).
      instance.connector.pusher.connection.bind("connected", () => {
        if (connectedOnce) setReconnects((n) => n + 1);
        connectedOnce = true;
      });
      setEcho(instance);
    })();
    return () => {
      cancelled = true;
      instance?.disconnect();
      setEcho(null);
    };
  }, [config]);

  return <Context.Provider value={{ echo, reconnects }}>{children}</Context.Provider>;
}

/** Listens to one event of a private channel while mounted. `onReconnect` runs after a dropped connection comes back. */
export function useRealtime<T>(channel: string | null, event: string, handler: (payload: T) => void, onReconnect?: () => void) {
  const { echo, reconnects } = React.useContext(Context);
  const latest = React.useRef(handler);
  const reconnect = React.useRef(onReconnect);
  React.useEffect(() => {
    latest.current = handler;
    reconnect.current = onReconnect;
  });

  React.useEffect(() => {
    if (!echo || !channel) return;
    const listener: Listener = (payload) => latest.current(payload as T);
    const subscription = echo.private(channel).listen(`.${event}`, listener);
    return () => {
      subscription.stopListening(`.${event}`, listener);
    };
  }, [echo, channel, event]);

  React.useEffect(() => {
    if (reconnects > 0) reconnect.current?.();
  }, [reconnects]);

  return echo !== null;
}
