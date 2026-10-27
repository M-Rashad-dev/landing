"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { fetchOrderStats, orderKeys } from "@/lib/orders/api";
import { ar } from "@/messages/ar";

const POLL_MS = 30_000;
const SOUND_KEY = "lp_order_sound";
const TITLE_PREFIX = /^\(\d+\)\s/;

/* ---------- Sound preference (localStorage, per browser) ---------- */

const listeners = new Set<() => void>();
function readSound(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}
function writeSound(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    // Storage blocked: the toggle just won't persist.
  }
  listeners.forEach((l) => l());
}
function useSoundPreference(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readSound,
    () => false,
  );
  return [on, writeSound];
}

/** Two short tones generated with Web Audio (no audio files). */
export function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1320].forEach((frequency, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.18;
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.17);
    });
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // Autoplay policy or no audio device: ignore.
  }
}

/** Keeps "(n) " in front of the tab title, also after Next changes the title on navigation. */
function useTitleCount(count: number) {
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(TITLE_PREFIX, "");
      const next = count > 0 ? `(${count}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    const title = document.querySelector("title");
    const observer = title ? new MutationObserver(apply) : null;
    if (title) observer?.observe(title, { childList: true });
    return () => {
      observer?.disconnect();
      document.title = document.title.replace(TITLE_PREFIX, "");
    };
  }, [count]);
}

/**
 * Dashboard-only order notifications: polls orders/stats every 30 s while the tab is visible,
 * toasts + optional chime when orders arrive, and exposes the "new" counter for the sidebar.
 */
export function useOrderNotifications() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const since = useRef<string | null>(null);
  const [sound] = useSoundPreference();
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const { data } = useQuery({
    queryKey: ["orders", "notifications"],
    queryFn: async () => {
      const stats = await fetchOrderStats(since.current);
      const arrived = since.current !== null ? (stats.new_since ?? 0) : 0;
      since.current = stats.server_time;
      return { ...stats, arrived };
    },
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const arrived = data?.arrived ?? 0;
  const stamp = data?.server_time;
  useEffect(() => {
    if (arrived <= 0) return;
    toast.success(ar.orders.newOrderToast(arrived), { action: { label: ar.orders.view, onClick: () => router.push("/dashboard/orders?status=new") } });
    if (soundRef.current) playChime();
    void queryClient.invalidateQueries({ queryKey: ["orders", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["orders", "stats"] });
    void queryClient.invalidateQueries({ queryKey: orderKeys.overview });
    // Keyed on the poll time so the same batch never toasts twice.
  }, [arrived, stamp, router, queryClient]);

  const newCount = data?.counts.new ?? 0;
  useTitleCount(newCount);

  return { newCount };
}

export function OrderSoundToggle() {
  const [sound, setSound] = useSoundPreference();
  const toggle = useCallback(() => {
    const next = !sound;
    setSound(next);
    if (next) playChime();
  }, [sound, setSound]);

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-pressed={sound} aria-label={sound ? ar.orders.soundOff : ar.orders.soundOn} title={ar.orders.sound}>
      {sound ? <Bell /> : <BellOff className="text-muted-foreground" />}
    </Button>
  );
}
