import type { Json } from '@metamask/utils';
import { Struct, assert } from 'superstruct';

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

/**
 * Assert that a value is valid according to a struct.
 *
 * It is similar to superstruct's mask function, but it does not ignore extra
 * properties.
 *
 * @param value - Value to check.
 * @param struct - Struct to validate the value against.
 * @param message - Error message to throw if the value is not valid.
 * @returns The value if it is valid.
 */
export function strictMask<T, S>(
  value: unknown,
  struct: Struct<T, S>,
  message?: string,
): T {
  assert(value, struct, message);
  return value;
}

/**
 * Remove duplicate entries from an array.
 *
 * @param array - Array to remove duplicates from.
 * @returns Array with duplicates removed.
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Convert a value to a valid JSON object.
 *
 * The function chains JSON.stringify and JSON.parse to ensure that the result
 * is a valid JSON object. In objects, undefined values are removed, and in
 * arrays, they are replaced with null.
 *
 * @param value - Value to convert to JSON.
 * @returns JSON representation of the value.
 */
export function toJson<T extends Json = Json>(value: any): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
