import type { Json } from '@metamask/utils';
import { Struct, assert } from 'superstruct';

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

/**
 * Asserts that the given value is defined.
 *
 * @param value - Value to check.
 */
export function ensureDefined<T>(value: T | undefined): asserts value is T {
  if (value === undefined) {
    throw new Error('Argument is undefined');
  }
}
