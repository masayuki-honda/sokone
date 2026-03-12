/**
 * Offline sync service — processes the upload queue when connectivity returns.
 *
 * Usage: Call `useOfflineSync()` in the root layout component.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { Alert } from "react-native";
import * as FileSystem from "expo-file-system";
import { useNetwork } from "@/hooks/use-network";
import { getQueue, dequeue, markRetry, type PendingUpload } from "./offline-queue";
import { api } from "./api";

const MAX_RETRIES = 3;

interface SyncState {
  isSyncing: boolean;
  pendingCount: number;
}

/**
 * Hook that watches the offline queue and syncs pending uploads
 * when network connectivity is restored.
 */
export function useOfflineSync(): SyncState {
  const { isConnected } = useNetwork();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const syncingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const queue = await getQueue();
      setPendingCount(queue.length);

      if (queue.length === 0) return;

      let completed = 0;
      let failed = 0;

      for (const entry of queue) {
        if (entry.retryCount >= MAX_RETRIES) {
          await dequeue(entry.id);
          failed += 1;
          continue;
        }

        try {
          await uploadEntry(entry);
          await dequeue(entry.id);
          completed += 1;
        } catch {
          await markRetry(entry.id);
          failed += 1;
        }
      }

      const remaining = await getQueue();
      setPendingCount(remaining.length);

      if (completed > 0) {
        Alert.alert(
          "オフラインアップロード完了",
          `${completed}件のアップロードが完了しました${failed > 0 ? `（${failed}件失敗）` : ""}`,
        );
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  // Check the queue on mount and when connectivity changes
  useEffect(() => {
    if (isConnected) {
      processQueue();
    }
  }, [isConnected, processQueue]);

  // Also refresh pending count periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      const queue = await getQueue();
      setPendingCount(queue.length);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  return { isSyncing, pendingCount };
}

/**
 * Upload a single queued entry to the server.
 */
async function uploadEntry(entry: PendingUpload): Promise<void> {
  const formData = new FormData();
  formData.append("sourceType", entry.sourceType);
  formData.append("storeId", entry.storeId);

  for (const uri of entry.imageUris) {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) continue;

    const fileName = uri.split("/").pop() || "photo.jpg";
    formData.append("files", {
      uri,
      type: "image/jpeg",
      name: fileName,
    } as unknown as Blob);
  }

  await api.upload("/api/images/upload", formData);
}
