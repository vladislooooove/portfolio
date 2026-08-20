/**
 * A one-shot signal so the loader can wait for the hero scene to render its
 * first frame, rather than guessing with a timer. Module level on purpose:
 * the canvas mounts lazily and is nowhere near the loader in the tree.
 */
let sceneReady = false;
const listeners = new Set<() => void>();

export function markSceneReady() {
  if (sceneReady) return;
  sceneReady = true;
  listeners.forEach((fn) => fn());
}

export function onSceneReady(fn: () => void) {
  if (sceneReady) {
    fn();
    return () => {};
  }
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isSceneReady() {
  return sceneReady;
}

/**
 * Fires when the loader starts leaving, so the hero entrance can begin under
 * it rather than after it, and the two reads as one movement.
 */
let loaderDone = false;
const loaderListeners = new Set<() => void>();

export function markLoaderDone() {
  if (loaderDone) return;
  loaderDone = true;
  loaderListeners.forEach((fn) => fn());
}

export function onLoaderDone(fn: () => void) {
  if (loaderDone) {
    fn();
    return () => {};
  }
  loaderListeners.add(fn);
  return () => {
    loaderListeners.delete(fn);
  };
}

export function isLoaderDone() {
  return loaderDone;
}
