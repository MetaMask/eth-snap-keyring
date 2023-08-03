import { KeyringAccountStruct } from '@metamask/keyring-api';
import { JsonStruct } from '@metamask/utils';
import {
  Infer,
  array,
  boolean,
  intersection,
  number,
  object,
  optional,
  record,
  string,
  union,
} from 'superstruct';

export const SnapMessageStruct = object({
  method: string(),
  params: optional(union([array(JsonStruct), record(string(), JsonStruct)])),
});

/**
 * Message sent by the snap to manage accounts and requests.
 */
export type SnapMessage = Infer<typeof SnapMessageStruct>;

export const SnapMetadataStruct = object({
  id: string(),
  name: optional(string()),
  enabled: boolean(),
});

export const InternalAccountStruct = intersection([
  KeyringAccountStruct,
  object({
    metadata: object({
      lastActive: optional(number()),
      lastSelected: optional(number()),
      snap: optional(SnapMetadataStruct),
      keyring: object({
        type: string(),
      }),
    }),
  }),
]);

export type InternalAccount = Infer<typeof InternalAccountStruct>;
