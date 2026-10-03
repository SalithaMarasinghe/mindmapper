declare module '@edyrkaj/openwakeword-wasm-browser' {
  export interface WakeWordEngineOptions {
    keywords?: string[];
    modelFiles?: Record<string, string>;
    externalDataFiles?: Record<string, string | { path: string; data: string }>;
    baseAssetUrl?: string;
    ortWasmPath?: string;
    frameSize?: number;
    sampleRate?: number;
    vadHangoverFrames?: number;
    detectionThreshold?: number;
    cooldownMs?: number;
    executionProviders?: string[];
    embeddingWindowSize?: number;
    debug?: boolean;
  }

  export interface DetectionEvent {
    keyword: string;
    score: number;
    at: number;
  }

  export class WakeWordEngine {
    constructor(options?: WakeWordEngineOptions);
    load(): Promise<void>;
    start(options?: { deviceId?: string; gain?: number }): Promise<void>;
    stop(): Promise<void>;
    setGain(value: number): void;
    setActiveKeywords(keywords: string[]): void;
    on(event: 'ready', handler: () => void): () => void;
    on(event: 'detect', handler: (data: DetectionEvent) => void): () => void;
    on(event: 'speech-start', handler: () => void): () => void;
    on(event: 'speech-end', handler: () => void): () => void;
    on(event: 'error', handler: (error: unknown) => void): () => void;
    off(event: string, handler: (...args: any[]) => void): void;
  }

  export const MODEL_FILE_MAP: Record<string, string>;
  export default WakeWordEngine;
}
