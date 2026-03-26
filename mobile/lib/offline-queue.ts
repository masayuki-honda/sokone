/**
 * Offline upload queue — saves pending uploads to local storage
 * and retries them when network connectivity is restored.
 */
import * as FileSystem from "expo-file-system";

const QUEUE_DIR = `${FileSystem.documentDirectory}offline-queue/`;
const QUEUE_INDEX = `${QUEUE_DIR}index.json`;

export interface PendingUpload {
  id: string;
  imageUris: string[];
  storeId: string;
  sourceType: string;
  createdAt: string;
  retryCount: number;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(QUEUE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(QUEUE_DIR, { intermediates: true });
  }
}

/**
 * Read the current queue of pending uploads.
 */
export async function getQueue(): Promise<PendingUpload[]> {
  try {
    const info = await FileSystem.getInfoAsync(QUEUE_INDEX);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(QUEUE_INDEX);
    return JSON.parse(raw) as PendingUpload[];
  } catch {
    return [];
  }
}

async function saveQueue(queue: PendingUpload[]): Promise<void> {
  await ensureDir();
  await FileSystem.writeAsStringAsync(QUEUE_INDEX, JSON.stringify(queue));
}

/**
 * Add a set of images to the offline queue for later upload.
 * Copies images into the queue directory so they survive temp cleanup.
 */
export async function enqueue(
  imageUris: string[],
  storeId: string,
  sourceType: string,
): Promise<PendingUpload> {
  await ensureDir();

  const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const savedUris: string[] = [];

  // Copy images to a persistent location
  for (let i = 0; i < imageUris.length; i++) {
    const ext = imageUris[i].split(".").pop() || "jpg";
    const dest = `${QUEUE_DIR}${id}-${i}.${ext}`;
    await FileSystem.copyAsync({ from: imageUris[i], to: dest });
    savedUris.push(dest);
  }

  const entry: PendingUpload = {
    id,
    imageUris: savedUris,
    storeId,
    sourceType,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  const queue = await getQueue();
  queue.push(entry);
  await saveQueue(queue);

  return entry;
}

/**
 * Remove a completed/failed entry from the queue (and clean up copied images).
 */
export async function dequeue(id: string): Promise<void> {
  const queue = await getQueue();
  const entry = queue.find((e) => e.id === id);

  // Delete copied images
  if (entry) {
    for (const uri of entry.imageUris) {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }

  await saveQueue(queue.filter((e) => e.id !== id));
}

/**
 * Increment the retry count for a queue entry.
 */
export async function markRetry(id: string): Promise<void> {
  const queue = await getQueue();
  const entry = queue.find((e) => e.id === id);
  if (entry) {
    entry.retryCount += 1;
  }
  await saveQueue(queue);
}

/**
 * Get the number of pending uploads.
 */
export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}
