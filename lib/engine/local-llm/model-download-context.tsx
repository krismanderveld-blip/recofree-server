/**
 * ModelDownloadContext — React context for model download state.
 * Provides download progress, status, and actions to the UI.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  type DownloadProgress,
  type DownloadStatus,
  isModelDownloaded,
  startDownload,
  pauseDownload,
  resumeDownload,
  onProgress,
  getModelPath,
} from './model-download-manager';
import { initGemmaEngine } from './engine-provider';

interface ModelDownloadState {
  status: DownloadStatus;
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
  error?: string;
  modelReady: boolean;
}

interface ModelDownloadActions {
  startModelDownload: () => Promise<void>;
  pauseModelDownload: () => Promise<void>;
  resumeModelDownload: () => Promise<void>;
  retryModelDownload: () => Promise<void>;
}

type ModelDownloadContextType = ModelDownloadState & ModelDownloadActions;

const ModelDownloadCtx = createContext<ModelDownloadContextType | null>(null);

export function ModelDownloadProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ModelDownloadState>({
    status: 'checking',
    progress: 0,
    bytesDownloaded: 0,
    totalBytes: 2_700_000_000,
    modelReady: false,
  });
  const initialCheckDone = useRef(false);

  // Subscribe to progress updates
  useEffect(() => {
    const unsubscribe = onProgress((progress: DownloadProgress) => {
      setState(prev => ({
        ...prev,
        status: progress.status,
        progress: progress.progress,
        bytesDownloaded: progress.bytesDownloaded,
        totalBytes: progress.totalBytes,
        error: progress.error,
      }));
    });
    return unsubscribe;
  }, []);

  // Check model on mount
  useEffect(() => {
    if (initialCheckDone.current) return;
    initialCheckDone.current = true;

    (async () => {
      const exists = await isModelDownloaded();
      if (exists) {
        // Model already downloaded — load it
        const success = await initGemmaEngine(getModelPath());
        setState(prev => ({
          ...prev,
          status: 'completed',
          progress: 1,
          modelReady: success,
        }));
      } else {
        setState(prev => ({ ...prev, status: 'idle' }));
      }
    })();
  }, []);

  // When download completes, load the engine
  useEffect(() => {
    if (state.status === 'completed' && !state.modelReady) {
      (async () => {
        const success = await initGemmaEngine(getModelPath());
        setState(prev => ({ ...prev, modelReady: success }));
      })();
    }
  }, [state.status, state.modelReady]);

  const startModelDownload = useCallback(async () => {
    const success = await startDownload();
    if (success) {
      const engineReady = await initGemmaEngine(getModelPath());
      setState(prev => ({ ...prev, modelReady: engineReady }));
    }
  }, []);

  const pauseModelDownload = useCallback(async () => {
    await pauseDownload();
  }, []);

  const resumeModelDownload = useCallback(async () => {
    const success = await resumeDownload();
    if (success) {
      const engineReady = await initGemmaEngine(getModelPath());
      setState(prev => ({ ...prev, modelReady: engineReady }));
    }
  }, []);

  const retryModelDownload = useCallback(async () => {
    await startModelDownload();
  }, [startModelDownload]);

  const value: ModelDownloadContextType = {
    ...state,
    startModelDownload,
    pauseModelDownload,
    resumeModelDownload,
    retryModelDownload,
  };

  return (
    <ModelDownloadCtx.Provider value={value}>
      {children}
    </ModelDownloadCtx.Provider>
  );
}

export function useModelDownload(): ModelDownloadContextType {
  const ctx = useContext(ModelDownloadCtx);
  if (!ctx) {
    throw new Error('useModelDownload must be used within ModelDownloadProvider');
  }
  return ctx;
}
