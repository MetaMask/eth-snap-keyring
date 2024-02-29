import {
  CAIP_NAMESPACE_REGEX,
  CAIP_REFERENCE_REGEX,
  isCaipNamespace,
  isCaipReference,
} from '@metamask/utils';
import type {
  CaipNamespace,
  CaipReference,
  CaipChainId,
} from '@metamask/utils';

/** Supported CAIP namespaces. */
export const CaipNamespaces = {
  /** Namespace for EIP-155 compatible chains. */
  Eip155: 'eip155' as CaipNamespace,
} as const;

/**
 * Chain ID as defined per the CAIP-2
 * {@link https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md}.
 *
 * It defines a way to uniquely identify any blockchain in a human-readable
 * way.
 *
 * @param namespace - The standard (ecosystem) of similar blockchains.
 * @param reference - Identify of a blockchain within a given namespace.
 * @throws {@link Error}
 * This exception is thrown if the inputs does not comply with the CAIP-2
 * syntax specification
 * {@link https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md#syntax}.
 * @returns A CAIP chain ID.
 */
export function toCaipChainId(
  namespace: CaipNamespace,
  reference: CaipReference,
): CaipChainId {
  if (!isCaipNamespace(namespace)) {
    throw new Error(
      `Invalid "namespace", must match: ${CAIP_NAMESPACE_REGEX.toString()}`,
    );
  }

  if (!isCaipReference(reference)) {
    throw new Error(
      `Invalid "reference", must match: ${CAIP_REFERENCE_REGEX.toString()}`,
    );
  }

  return `${namespace}:${reference}`;
}
