import { useState, useEffect, useCallback, useMemo } from "react";

const STORAGE_KEY = "gemini_usage";
// Free tier limits for gemini-2.5-flash (confirmed in AI Studio)
const DAILY_LIMIT = 10000; // 10K RPD
const PER_MINUTE_LIMIT = 1000; // 1K RPM

interface UsageEntry {
  /** ISO date string of the Gemini quota reset (JST 17:00 = UTC 08:00) */
  resetAt: string;
  /** Total API calls made in this quota period */
  totalCalls: number;
  /** Timestamps (epoch ms) of the last 60 seconds of calls, for per-minute tracking */
  recentCallTimestamps: number[];
}

/**
 * Returns the start of the current Gemini quota period.
 * Gemini free tier resets daily at UTC 00:00 (= JST 09:00).
 * Previously documented as PST 00:00 / JST 17:00, but the actual reset
 * aligns with UTC midnight. We use UTC date key to be safe.
 */
function getQuotaResetKey(): string {
  const now = new Date();
  // Use UTC date string as the key (resets at UTC 00:00)
  return now.toISOString().slice(0, 10); // e.g. "2026-03-03"
}

function loadUsage(): UsageEntry {
  if (typeof window === "undefined") {
    return { resetAt: getQuotaResetKey(), totalCalls: 0, recentCallTimestamps: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as UsageEntry;
    // Reset if quota period has changed
    if (parsed.resetAt !== getQuotaResetKey()) {
      throw new Error("stale");
    }
    return parsed;
  } catch {
    return { resetAt: getQuotaResetKey(), totalCalls: 0, recentCallTimestamps: [] };
  }
}

function saveUsage(entry: UsageEntry) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
}

export interface GeminiUsage {
  /** Total calls in the current quota period */
  totalCalls: number;
  /** Calls in the last 60 seconds */
  callsLastMinute: number;
  /** Daily limit */
  dailyLimit: number;
  /** Per-minute limit */
  perMinuteLimit: number;
  /** Record a new API call */
  recordCall: () => void;
  /** Reset counters (for testing) */
  reset: () => void;
}

export function useGeminiUsage(): GeminiUsage {
  // Always start with zeros to avoid SSR/client hydration mismatch.
  // localStorage is loaded after mount via useEffect.
  const [usage, setUsage] = useState<UsageEntry>({
    resetAt: "",
    totalCalls: 0,
    recentCallTimestamps: [],
  });

  // Load from localStorage after mount (client only)
  useEffect(() => {
    setUsage(loadUsage());
  }, []);

  // Recompute stats once per second so per-minute count stays fresh
  useEffect(() => {
    const timer = setInterval(() => {
      setUsage((prev) => {
        const now = Date.now();
        const cutoff = now - 60_000;
        const fresh = prev.recentCallTimestamps.filter((t) => t > cutoff);
        if (fresh.length === prev.recentCallTimestamps.length) return prev;
        const next = { ...prev, recentCallTimestamps: fresh };
        saveUsage(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const recordCall = useCallback(() => {
    setUsage((prev) => {
      const now = Date.now();
      const cutoff = now - 60_000;
      const fresh = prev.recentCallTimestamps.filter((t) => t > cutoff);
      const next: UsageEntry = {
        resetAt: getQuotaResetKey(),
        totalCalls: prev.totalCalls + 1,
        recentCallTimestamps: [...fresh, now],
      };
      saveUsage(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const fresh: UsageEntry = {
      resetAt: getQuotaResetKey(),
      totalCalls: 0,
      recentCallTimestamps: [],
    };
    saveUsage(fresh);
    setUsage(fresh);
  }, []);

  const callsLastMinute = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    return usage.recentCallTimestamps.filter((t) => t > now - 60_000).length;
  }, [usage.recentCallTimestamps]);

  return {
    totalCalls: usage.totalCalls,
    callsLastMinute,
    dailyLimit: DAILY_LIMIT,
    perMinuteLimit: PER_MINUTE_LIMIT,
    recordCall,
    reset,
  };
}
