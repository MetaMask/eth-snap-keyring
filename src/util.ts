/**
 * A deferred Promise.
 *
 * A deferred Promise is one that can be resolved or rejected independently of
 * the Promise construction.
 *
 * @typedef {object} DeferredPromise
 * @property {Promise} promise - The Promise that has been deferred.
 * @property {() => void} resolve - A function that resolves the Promise.
 * @property {() => void} reject - A function that rejects the Promise.
 */

export interface DeferredPromise {
  promise: Promise<any>;
  resolve?: () => void;
  reject?: () => void;
}

/**
 * Create a deferred Promise.
 *
 * @returns A deferred Promise.
 */
export function deferredPromise(): DeferredPromise {
  let resolve: DeferredPromise['resolve'];
  let reject: DeferredPromise['reject'];

  const promise = new Promise<void>(
    (innerResolve: () => void, innerReject: () => void) => {
      resolve = innerResolve;
      reject = innerReject;
    },
  );
  return { promise, resolve, reject };
}
