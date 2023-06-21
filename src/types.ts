import type { Json } from '@metamask/utils';

/**
 * Message sent by the snap to manage accounts and requests.
 */
export type SnapMessage = [string, Json[] | Record<string, Json>];
