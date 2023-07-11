import { KeyringAccount } from '@metamask/keyring-api';
import { JsonStruct } from '@metamask/utils';
import {
  Infer,
  array,
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

export type InternalAccount = KeyringAccount & {
  metadata: {
    snap?:
      | {
          id?: string | undefined;
          name?: string | undefined;
          enabled?: boolean | undefined;
        }
      | undefined;
    keyring?:
      | {
          type?: string | undefined;
        }
      | undefined;
  };
};
