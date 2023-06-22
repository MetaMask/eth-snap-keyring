import { DeferredPromise } from './util';

describe('DeferredPromise', () => {
  describe('constructor', () => {
    it('should not fail to create a DeferredPromise', () => {
      expect(() => new DeferredPromise()).not.toThrow();
    });

    it('should define resolve and reject fields', () => {
      const promise = new DeferredPromise();
      expect(promise.resolve).toBeDefined();
      expect(promise.reject).toBeDefined();
    });
  });
});
