// Local-image URL helpers.
//
// `cover_image` on a game may be either:
//   - a remote HTTP(S) URL — passed through unchanged, or
//   - a local absolute file path (CoverImages / library/images).
//
// Tauri 2's asset protocol (`convertFileSrc`) is unreliable for absolute
// filesystem paths on Windows (scope glob matching differences across patch
// versions). The reliable approach is to load local images via the
// `read_images_batch` backend command, which returns raw bytes + MIME type
// for many paths in a single IPC call. We turn the bytes into `blob:` URLs on
// the frontend and cache them (LRU) so each file is only read once and the
// memory footprint stays bounded.

import { api } from "../api/client";
import { useImageProgressStore } from "../stores/imageProgressStore";

const isRemote = (s: string) => /^https?:\/\//i.test(s) || /^asset:\/\//i.test(s);
const isLocalPath = (s: string) => /^[a-zA-Z]:[\\/]/i.test(s) || s.startsWith("/") || s.startsWith("\\");

/**
 * Decode a base64 string into bytes backed by a standard `ArrayBuffer` (the
 * WebView2 runtime always provides `atob`). The result is safe to hand to
 * `new Blob(...)`.
 */
function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(new ArrayBuffer(len));
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** How many paths we send in one IPC call (keeps each round-trip fast). */
const BATCH_SIZE = 24;
/** How many concurrent batches to keep in flight. */
const BATCH_CONCURRENCY = 2;
/** Max number of blob URLs to keep resident in the frontend cache. */
const BLOB_LRU_CAP = 220;

// ---- LRU blob URL cache ---------------------------------------------------

interface BlobEntry {
  url: string;
  size: number; // approximate bytes for LRU accounting
}

const blobCache = new Map<string, BlobEntry>();
/** Paths currently being fetched (to avoid duplicate in-flight requests). */
const inflight = new Map<string, Promise<string | undefined>>();

function touchBlobCacheSize() {
  // Approximate LRU eviction using the Map's insertion order. We re-insert
  // touched entries to move them to the back, then drop the front.
  while (blobCache.size > BLOB_LRU_CAP) {
    const oldest = blobCache.keys().next().value;
    if (!oldest) break;
    const e = blobCache.get(oldest);
    if (e) {
      try {
        URL.revokeObjectURL(e.url);
      } catch {
        /* ignore */
      }
    }
    blobCache.delete(oldest);
  }
}

function putBlob(path: string, url: string) {
  const size = Math.max(1, Math.round(url.length / 4)); // very rough byte estimate
  // Re-insert to move to back (LRU).
  blobCache.delete(path);
  blobCache.set(path, { url, size });
  touchBlobCacheSize();
}

function getBlob(path: string): string | undefined {
  const e = blobCache.get(path);
  if (!e) return undefined;
  // Touch.
  blobCache.delete(path);
  blobCache.set(path, e);
  return e.url;
}

// ---- Single-image loading (concurrency-limited) --------------------------

/** Maximum concurrent single-image IPC requests in flight. Prevents the UI
 * from being flooded when a large grid mounts all at once. Kept small so
 * images fade in progressively instead of all at once. */
const SINGLE_CONCURRENCY = 3;
let activeSingle = 0;
const singleQueue: Array<() => void> = [];

function acquireSingle(): Promise<void> {
  if (activeSingle < SINGLE_CONCURRENCY) {
    activeSingle++;
    return Promise.resolve();
  }
  return new Promise((resolve) => singleQueue.push(resolve));
}
function releaseSingle() {
  const next = singleQueue.shift();
  if (next) {
    next(); // hand off the slot
  } else {
    activeSingle--;
  }
}

async function loadOne(path: string): Promise<string | undefined> {
  const existing = inflight.get(path);
  if (existing) return existing;
  const p = (async () => {
    await acquireSingle();
    try {
      const res = await api.readImage(path);
      const arr = base64ToBytes(res.data);
      const blob = new Blob([arr], { type: res.mime });
      const url = URL.createObjectURL(blob);
      putBlob(path, url);
      return url;
    } catch {
      return undefined;
    } finally {
      releaseSingle();
      inflight.delete(path);
    }
  })();
  inflight.set(path, p);
  return p;
}

// ---- Batch loader ---------------------------------------------------------

async function loadBatch(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const results = await api.readImagesBatch(paths);
    for (let i = 0; i < paths.length; i++) {
      const r = results[i];
      if (!r) continue;
      const arr = base64ToBytes(r.data);
      const blob = new Blob([arr], { type: r.mime });
      const url = URL.createObjectURL(blob);
      putBlob(paths[i], url);
    }
  } catch {
    /* swallow — individual paths can be retried later */
  } finally {
    // Mark all in-flight entries for these paths as done.
    for (const p of paths) inflight.delete(p);
  }
}

// Ensure the given local path is being loaded (single-flight).
function ensureLocal(path: string): Promise<string | undefined> {
  const cached = getBlob(path);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(path);
  if (existing) return existing;
  const p = loadOne(path);
  inflight.set(path, p);
  return p;
}

// ---- Public API -----------------------------------------------------------

/**
 * Synchronously returns a usable URL for `<img src>` for a local-or-remote
 * image path. Remote URLs pass through unchanged. For local paths, returns
 * the cached blob URL if available, otherwise `undefined` — the caller is
 * expected to trigger `ensureImageLoaded` for missing paths.
 */
export function imageUrl(src?: string): string | undefined {
  if (!src || !src.trim()) return undefined;
  const s = src.trim();
  if (isRemote(s)) return s;
  if (!isLocalPath(s)) return undefined;
  // Return the cached blob URL if already loaded. Loading is triggered by the
  // IntersectionObserver (useLazyImage) so we never flood IPC at mount time.
  return getBlob(s);
}

/** Async variant: returns the blob URL once the bytes are loaded. */
export async function imageUrlAsync(src?: string): Promise<string | undefined> {
  if (!src || !src.trim()) return undefined;
  const s = src.trim();
  if (isRemote(s)) return s;
  if (!isLocalPath(s)) return undefined;
  return ensureLocal(s);
}

/** Begin loading a single path; resolves when the bytes are decoded into a blob URL. */
export function ensureImageLoaded(path: string): Promise<string | undefined> {
  return ensureLocal(path);
}

/**
 * Pre-load all local images in a list of paths (e.g. on app startup), batching
 * IPC calls so the UI stays responsive, and reporting progress through
 * `useImageProgressStore`. Each IPC call covers up to `BATCH_SIZE` paths; up
 * to `BATCH_CONCURRENCY` batches are in flight at once.
 */
export async function preloadImages(paths: Array<string | undefined>): Promise<void> {
  const unique = new Set<string>();
  for (const p of paths) {
    if (!p) continue;
    const s = p.trim();
    if (!isRemote(s) && isLocalPath(s) && !getBlob(s) && !inflight.has(s)) unique.add(s);
  }
  const pending = [...unique];
  if (pending.length === 0) return;

  const progress = useImageProgressStore.getState();
  progress.begin(pending.length);

  // Split into chunks; run a small pool of chunks in parallel.
  const chunks: string[][] = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    chunks.push(pending.slice(i, i + BATCH_SIZE));
  }

  let cursor = 0;
  async function worker() {
    while (cursor < chunks.length) {
      const myIdx = cursor++;
      if (myIdx >= chunks.length) return;
      const chunk = chunks[myIdx];
      // Mark every path in this chunk as in-flight so a concurrent preload
      // call doesn't double-fetch the same paths.
      for (const p of chunk) {
        inflight.set(p, loadOne(p).then((u) => u));
      }
      await loadBatch(chunk);
      for (let k = 0; k < chunk.length; k++) progress.tick();
    }
  }
  const workers = Array.from({ length: Math.min(BATCH_CONCURRENCY, chunks.length) }, () => worker());
  await Promise.all(workers);

  progress.reset();
}

/** Pre-load images from a list of games (cover / background / icon / screenshots). */
export async function preloadGameImages(
  games: Array<{
    coverImage?: string;
    backgroundImage?: string;
    icon?: string;
    screenshots?: string[];
  }>
): Promise<void> {
  const paths: Array<string | undefined> = [];
  for (const g of games) {
    paths.push(g.coverImage, g.backgroundImage, g.icon);
    if (g.screenshots) paths.push(...g.screenshots);
  }
  await preloadImages(paths);
}

/** Release cached blob URLs (call on app teardown). */
export function releaseImageCache(): void {
  for (const e of blobCache.values()) {
    try {
      URL.revokeObjectURL(e.url);
    } catch {
      /* ignore */
    }
  }
  blobCache.clear();
}

/** Force-reload a single image path (e.g. after a rescan). */
export function invalidateImage(path: string): void {
  const e = blobCache.get(path);
  if (e) {
    try {
      URL.revokeObjectURL(e.url);
    } catch {
      /* ignore */
    }
    blobCache.delete(path);
  }
  void api.clearImageCache().catch(() => undefined);
}