import { KeyringAccountStruct } from '@metamask/keyring-api';
import { JsonStruct } from '@metamask/utils';
import {
  Infer,
  array,
  boolean,
  intersection,
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

export const InternalAccountStruct = intersection([
  KeyringAccountStruct,
  object({
    metadata: object({
      snap: optional(
        object({
          id: string(),
          name: optional(string()),
          enabled: boolean(),
        }),
      ),
      keyring: object({
        type: string(),
      }),
    }),
  }),
]);

export type InternalAccount = Infer<typeof InternalAccountStruct>;
