/**
 * A deferred promise can be resolved by a caller different from the one who
 * created it.
 *
 * Example:
 * - "A" creates a deferred promise "P", adds it to a list, and awaits it
 * - "B" gets "P" from the list and resolves it
 * - "A" gets the resolved value
 */
export class DeferredPromise<T> {
  promise: Promise<T>;

  resolve?: (value: T | PromiseLike<T>) => void;

  reject?: (reason?: any) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
