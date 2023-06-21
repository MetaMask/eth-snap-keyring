import { JsonStruct } from '@metamask/utils';
import { Infer, string, tuple } from 'superstruct';

export const SnapMessageStruct = tuple([string(), JsonStruct]);

/**
 * Message sent by the snap to manage accounts and requests.
 */
export type SnapMessage = Infer<typeof SnapMessageStruct>;
