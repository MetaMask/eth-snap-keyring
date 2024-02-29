import { toCaipChainId, CaipNamespaces } from './caip';

describe('toCaipChainId', () => {
  // This function relies on @metamask/utils CAIP helpers. Those are being
  // tested with a variety of inputs.
  // Here we mainly focus on our own wrapper around those:

  it('returns a valid CAIP-2 chain ID', () => {
    const namespace = CaipNamespaces.Eip155;
    const reference = '1';
    expect(toCaipChainId(namespace, reference)).toBe(
      `${namespace}:${reference}`,
    );
  });

  it.each([
    // Too short, must have 3 chars at least
    '',
    'xs',
    // Not matching
    '!@#$%^&*()',
    // Too long
    'namespacetoolong',
  ])('throws for invalid namespaces: %s', (namespace) => {
    const reference = '1';
    // eslint-disable-next-line jest/require-to-throw-message
    expect(() => toCaipChainId(namespace, reference)).toThrow();
  });

  it.each([
    // Too short, must have 1 char at least
    '',
    // Not matching
    '!@#$%^&*()',
    // Too long
    '012345678901234567890123456789012', // 33 chars
  ])('throws for invalid reference: %s', (reference) => {
    const namespace = CaipNamespaces.Eip155;
    // eslint-disable-next-line jest/require-to-throw-message
    expect(() => toCaipChainId(namespace, reference)).toThrow();
  });
});
