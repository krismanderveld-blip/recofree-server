/**
 * ModelDownloadManager — handles downloading the Gemma 3 4B GGUF model.
 *
 * Features:
 * - WiFi-only check (via expo-network)
 * - Resumable download (uses expo-file-system createDownloadResumable)
 * - Progress callback
 * - Retry on failure
 * - Checks if model already exists before downloading
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { GEMMA_MODEL_FILENAME } from './gemma-signal-engine';

// ─── Constants ──────────────────────────────────────────────────

const MODEL_URL = 'https://huggingface.co/ggml-org/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf';
const MODELS_DIR = 'models/';

export type DownloadStatus = 'idle' | 'checking' | 'downloading' | 'completed' | 'error' | 'no-wifi' | 'paused';

export interface DownloadProgress {
  status: DownloadStatus;
  progress: number; // 0-1
  bytesDownloaded: number;
  totalBytes: number;
  error?: string;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

// ─── Manager ────────────────────────────────────────────────────

let downloadResumable: FileSystem.DownloadResumable | null = null;
let currentStatus: DownloadProgress = {
  status: 'idle',
  progress: 0,
  bytesDownloaded: 0,
  totalBytes: 2_700_000_000,
};
let progressListeners: ProgressCallback[] = [];

/**
 * Get the full path where the model should be stored.
 */
export function getModelPath(): string {
  return `${FileSystem.documentDirectory}${MODELS_DIR}${GEMMA_MODEL_FILENAME}`;
}

/**
 * Check if the model file already exists on device.
 */
export async function isModelDownloaded(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(getModelPath());
    // Check exists and has reasonable size (> 1 GB)
    return info.exists && (info.size ?? 0) > 1_000_000_000;
  } catch {
    return false;
  }
}

/**
 * Subscribe to download progress updates.
 */
export function onProgress(callback: ProgressCallback): () => void {
  progressListeners.push(callback);
  // Immediately emit current state
  callback(currentStatus);
  return () => {
    progressListeners = progressListeners.filter(l => l !== callback);
  };
}

/**
 * Get current download status.
 */
export function getDownloadStatus(): DownloadProgress {
  return { ...currentStatus };
}

/**
 * Start downloading the model. WiFi-only.
 * Returns true if download completed successfully.
 */
export async function startDownload(): Promise<boolean> {
  // Check if already downloaded
  if (await isModelDownloaded()) {
    emitProgress({ status: 'completed', progress: 1, bytesDownloaded: currentStatus.totalBytes, totalBytes: currentStatus.totalBytes });
    return true;
  }

  // Check WiFi
  emitProgress({ ...currentStatus, status: 'checking' });
  const networkState = await Network.getNetworkStateAsync();
  if (networkState.type !== Network.NetworkStateType.WIFI) {
    emitProgress({ ...currentStatus, status: 'no-wifi', error: 'WiFi required for download' });
    return false;
  }

  // Ensure models directory exists
  const modelsDir = `${FileSystem.documentDirectory}${MODELS_DIR}`;
  const dirInfo = await FileSystem.getInfoAsync(modelsDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(modelsDir, { intermediates: true });
  }

  // Check for partial download (resume support)
  const tempPath = getModelPath() + '.part';
  const tempInfo = await FileSystem.getInfoAsync(tempPath);
  const startByte = tempInfo.exists ? (tempInfo.size ?? 0) : 0;

  emitProgress({ status: 'downloading', progress: 0, bytesDownloaded: startByte, totalBytes: currentStatus.totalBytes });

  try {
    downloadResumable = FileSystem.createDownloadResumable(
      MODEL_URL,
      tempPath,
      {
        headers: startByte > 0 ? { Range: `bytes=${startByte}-` } : undefined,
      },
      (downloadProgress) => {
        const totalWritten = downloadProgress.totalBytesWritten + startByte;
        const total = downloadProgress.totalBytesExpectedToWrite > 0
          ? downloadProgress.totalBytesExpectedToWrite + startByte
          : currentStatus.totalBytes;
        const progress = total > 0 ? totalWritten / total : 0;
        emitProgress({
          status: 'downloading',
          progress: Math.min(progress, 0.99),
          bytesDownloaded: totalWritten,
          totalBytes: total,
        });
      }
    );

    const result = await downloadResumable.downloadAsync();
    downloadResumable = null;

    if (result && result.uri) {
      // Move from .part to final path
      await FileSystem.moveAsync({ from: tempPath, to: getModelPath() });
      emitProgress({ status: 'completed', progress: 1, bytesDownloaded: currentStatus.totalBytes, totalBytes: currentStatus.totalBytes });
      return true;
    } else {
      emitProgress({ ...currentStatus, status: 'error', error: 'Download returned no result' });
      return false;
    }
  } catch (error) {
    downloadResumable = null;
    const message = error instanceof Error ? error.message : 'Unknown error';
    emitProgress({ ...currentStatus, status: 'error', error: message });
    return false;
  }
}

/**
 * Pause the current download.
 */
export async function pauseDownload(): Promise<void> {
  if (downloadResumable) {
    try {
      await downloadResumable.pauseAsync();
      emitProgress({ ...currentStatus, status: 'paused' });
    } catch {
      // Ignore pause errors
    }
  }
}

/**
 * Resume a paused download.
 */
export async function resumeDownload(): Promise<boolean> {
  if (!downloadResumable) {
    // Start fresh if no resumable exists
    return startDownload();
  }

  // Re-check WiFi
  const networkState = await Network.getNetworkStateAsync();
  if (networkState.type !== Network.NetworkStateType.WIFI) {
    emitProgress({ ...currentStatus, status: 'no-wifi', error: 'WiFi required for download' });
    return false;
  }

  emitProgress({ ...currentStatus, status: 'downloading' });

  try {
    const result = await downloadResumable.resumeAsync();
    downloadResumable = null;

    if (result && result.uri) {
      const tempPath = getModelPath() + '.part';
      await FileSystem.moveAsync({ from: tempPath, to: getModelPath() });
      emitProgress({ status: 'completed', progress: 1, bytesDownloaded: currentStatus.totalBytes, totalBytes: currentStatus.totalBytes });
      return true;
    } else {
      emitProgress({ ...currentStatus, status: 'error', error: 'Resume returned no result' });
      return false;
    }
  } catch (error) {
    downloadResumable = null;
    const message = error instanceof Error ? error.message : 'Unknown error';
    emitProgress({ ...currentStatus, status: 'error', error: message });
    return false;
  }
}

/**
 * Delete the downloaded model (free up space).
 */
export async function deleteModel(): Promise<void> {
  try {
    await FileSystem.deleteAsync(getModelPath(), { idempotent: true });
    await FileSystem.deleteAsync(getModelPath() + '.part', { idempotent: true });
    emitProgress({ status: 'idle', progress: 0, bytesDownloaded: 0, totalBytes: currentStatus.totalBytes });
  } catch {
    // Ignore delete errors
  }
}

// ─── Internal ───────────────────────────────────────────────────

function emitProgress(progress: DownloadProgress): void {
  currentStatus = progress;
  for (const listener of progressListeners) {
    try {
      listener(progress);
    } catch {
      // Don't let listener errors break the download
    }
  }
}
