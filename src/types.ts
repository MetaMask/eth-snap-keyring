import { JsonStruct } from '@metamask/utils';
import type { Infer } from 'superstruct';
import { array, object, optional, record, string, union } from 'superstruct';

export const SnapMessageStruct = object({
  method: string(),
  params: optional(union([array(JsonStruct), record(string(), JsonStruct)])),
});

/**
 * Message sent by the snap to manage accounts and requests.
 */
export type SnapMessage = Infer<typeof SnapMessageStruct>;
