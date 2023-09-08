export class CaseInsensitiveMap<T> extends Map<string, T> {
  static fromObject<T>(obj: Record<string, T>): CaseInsensitiveMap<T> {
    return new CaseInsensitiveMap(Object.entries(obj));
  }

  toObject(): Record<string, T> {
    return Object.fromEntries(this.entries());
  }

  get(key: string): T | undefined {
    return super.get(key.toLowerCase());
  }

  /**
   * Return the value associated with the given key, or throw an error if the
   * key is not found.
   *
   * @param key - The key to look up in the map.
   * @param name - Optional name of the key to include in the error message.
   * @returns The value associated with the given key.
   */
  getOrThrow(key: string, name = 'Key'): T {
    const value = this.get(key);
    if (value === undefined) {
      throw new Error(`${name} '${key}' not found`);
    }
    return value;
  }

  has(key: string): boolean {
    return super.has(key.toLowerCase());
  }

  set(key: string, value: T): this {
    return super.set(key.toLowerCase(), value);
  }

  delete(key: string): boolean {
    return super.delete(key.toLowerCase());
  }
}
