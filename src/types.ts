import { JsonStruct } from '@metamask/utils';
import { Infer, array, record, string, tuple, union } from 'superstruct';

export const SnapMessageStruct = tuple([string(), JsonStruct]);

/**
 * Message sent by the snap to manage accounts and requests.
 */
export type SnapMessage = Infer<typeof SnapMessageStruct>;
