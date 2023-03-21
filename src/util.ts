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
