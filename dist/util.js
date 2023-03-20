"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deferredPromise = void 0;
/**
 * Create a deferred Promise.
 *
 * @returns A deferred Promise.
 */
function deferredPromise() {
    let resolve;
    let reject;
    const promise = new Promise((innerResolve, innerReject) => {
        resolve = innerResolve;
        reject = innerReject;
    });
    return { promise, resolve, reject };
}
exports.deferredPromise = deferredPromise;
//# sourceMappingURL=util.js.map