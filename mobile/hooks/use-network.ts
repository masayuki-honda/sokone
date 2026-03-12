import { useState, useEffect, useCallback, useRef } from "react";
import * as Network from "expo-network";

interface NetworkState {
  isConnected: boolean;
  isLoading: boolean;
}

/**
 * Hook that monitors network connectivity.
 * Polls every 10 seconds and provides the current state.
 */
export function useNetwork(): NetworkState {
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const check = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      setIsConnected(state.isConnected ?? false);
    } catch {
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check]);

  return { isConnected, isLoading };
}
