import type { TypedTransaction } from '@ethereumjs/tx';
import { TransactionFactory } from '@ethereumjs/tx';
import type { TypedDataV1, TypedMessage } from '@metamask/eth-sig-util';
import { SignTypedDataVersion } from '@metamask/eth-sig-util';
import type { KeyringAccount, InternalAccount } from '@metamask/keyring-api';
import {
  KeyringAccountStruct,
  EthMethod,
  KeyringSnapControllerClient,
} from '@metamask/keyring-api';
import { KeyringEvent } from '@metamask/keyring-api/dist/events';
import type { SnapController } from '@metamask/snaps-controllers';
import type { Json } from '@metamask/utils';
import { bigIntToHex } from '@metamask/utils';
import { EventEmitter } from 'events';
import type { Infer } from 'superstruct';
import { assert, object, string, record, mask } from 'superstruct';
import { v4 as uuid } from 'uuid';

import { CaseInsensitiveMap } from './CaseInsensitiveMap';
import { DeferredPromise } from './DeferredPromise';
import type { SnapMessage } from './types';
import { SnapMessageStruct } from './types';
import { strictMask, toJson, unique } from './util';

export const SNAP_KEYRING_TYPE = 'Snap Keyring';

export const KeyringStateStruct = object({
  addressToAccount: record(string(), KeyringAccountStruct),
  addressToSnapId: record(string(), string()),
});

export type KeyringState = Infer<typeof KeyringStateStruct>;

export type SnapKeyringCallbacks = {
  saveState: () => Promise<void>;
  removeAccount(address: string): Promise<void>;
  addressExists(address: string): Promise<boolean>;
};

/**
 * Keyring bridge implementation to support snaps.
 */
export class SnapKeyring extends EventEmitter {
  static type: string = SNAP_KEYRING_TYPE;

  type: string;

  /**
   * Client used to call the snap keyring.
   */
  #snapClient: KeyringSnapControllerClient;

  /**
   * Mapping between account addresses and account objects.
   */
  #addressToAccount: CaseInsensitiveMap<KeyringAccount>;

  /**
   * Mapping between account addresses and snap IDs.
   */
  #addressToSnapId: CaseInsensitiveMap<string>;

  /**
   * Mapping between request IDs and their deferred promises.
   */
  #pendingRequests: CaseInsensitiveMap<DeferredPromise<any>>;

  /**
   * Callbacks used by the snap keyring to interact with other components.
   */
  #callbacks: SnapKeyringCallbacks;

  constructor(controller: SnapController, callbacks: SnapKeyringCallbacks) {
    super();
    this.type = SnapKeyring.type;
    this.#snapClient = new KeyringSnapControllerClient({ controller });
    this.#addressToAccount = new CaseInsensitiveMap();
    this.#addressToSnapId = new CaseInsensitiveMap();
    this.#pendingRequests = new CaseInsensitiveMap();
    this.#callbacks = callbacks;
  }

  /**
   * Handle a message from a snap.
   *
   * @param snapId - ID of the snap.
   * @param message - Message sent by the snap.
   * @returns The execution result.
   */
  async handleKeyringSnapMessage(
    snapId: string,
    message: SnapMessage,
  ): Promise<Json> {
    assert(message, SnapMessageStruct);
    const { method, params } = message;

    switch (method) {
      case KeyringEvent.AccountCreated: {
        const { account } = params as { account: KeyringAccount };

        // TODO: The UI still uses the account address to identify accounts, so
        // we need to block the creation of duplicate accounts for now to
        // prevent accounts from being overwritten.
        if (await this.#callbacks.addressExists(account.address)) {
          throw new Error(`Account '${account.address}' already exists`);
        }

        this.#addAccountToMaps(account, snapId);
        await this.#callbacks.saveState();
        return null;
      }

      case KeyringEvent.AccountUpdated: {
        const { account } = params as { account: KeyringAccount };

        // A snap cannot update an account that doesn't exist.
        const currentAccount = this.#getAccountById(account.id);
        if (currentAccount === undefined) {
          throw new Error(`Account '${account.id}' not found`);
        }

        // The address of the account cannot be changed. In the future, we will
        // support changing the address of an account since it will be required
        // to support UTXO-based chains.
        if (currentAccount.address !== account.address) {
          throw new Error(`Cannot change address of account '${account.id}'`);
        }

        // A snap cannot update an account that it doesn't own.
        if (this.#addressToSnapId.get(account.address) !== snapId) {
          throw new Error(`Cannot update account '${account.id}'`);
        }

        this.#addAccountToMaps(account, snapId);
        await this.#callbacks.saveState();
        return null;
      }

      case KeyringEvent.AccountDeleted: {
        const { id } = params as { id: string };
        const account = this.#getAccountById(id);

        // We can ignore the case where the account was already removed from
        // the keyring, making the deletion idempotent.
        //
        // This happens when the keyring calls the snap to delete an account,
        // and the snap responds with an AccountDeleted event.
        if (account !== undefined) {
          await this.#callbacks.removeAccount(account.address);
        }

        return null;
      }

      case KeyringEvent.RequestApproved: {
        const { id, result } = params as { id: string; result: Json };
        this.#resolveRequest(id, result);
        return null;
      }

      case KeyringEvent.RequestRejected: {
        const { id } = params as { id: string };
        this.#rejectRequest(id);
        return null;
      }

      default:
        throw new Error(`Method not supported: ${method}`);
    }
  }

  /**
   * Serialize the keyring state.
   *
   * @returns Serialized keyring state.
   */
  async serialize(): Promise<KeyringState> {
    return {
      addressToAccount: this.#addressToAccount.toObject(),
      addressToSnapId: this.#addressToSnapId.toObject(),
    };
  }

  /**
   * Deserialize the keyring state into this keyring.
   *
   * @param state - Serialized keyring state.
   */
  async deserialize(state: KeyringState | undefined): Promise<void> {
    // If the state is undefined, it means that this is a new keyring, so we
    // don't need to do anything.
    if (state === undefined) {
      return;
    }

    assert(state, KeyringStateStruct);

    this.#addressToAccount = CaseInsensitiveMap.fromObject(
      state.addressToAccount,
    );

    this.#addressToSnapId = CaseInsensitiveMap.fromObject(
      state.addressToSnapId,
    );
  }

  /**
   * Get the addresses of the accounts in this keyring.
   *
   * @returns The addresses of the accounts in this keyring.
   */
  async getAccounts(): Promise<string[]> {
    return unique([...this.#addressToAccount.keys()]);
  }

  /**
   * Submit a request to a snap.
   *
   * @param opts - Request options.
   * @param opts.address - Account address.
   * @param opts.method - Method to call.
   * @param opts.params - Method parameters.
   * @param opts.chainId - Selected chain ID (CAIP-2).
   * @returns Promise that resolves to the result of the method call.
   */
  async #submitRequest<Response extends Json>({
    address,
    method,
    params,
    chainId = '',
  }: {
    address: string;
    method: string;
    params?: Json[] | Record<string, Json>;
    chainId?: string;
  }): Promise<Json> {
    const { account, snapId } = this.#resolveAddress(address);
    const requestId = uuid();

    // Create the promise before calling the snap to prevent a race condition
    // where the snap responds before we have a chance to create it.
    const promise = new DeferredPromise<Response>();
    this.#pendingRequests.set(requestId, promise);

    const response = await (async () => {
      try {
        return await this.#snapClient.withSnapId(snapId).submitRequest({
          id: requestId,
          scope: chainId,
          account: account.id,
          request: {
            method,
            ...(params !== undefined && { params }),
          },
        });
      } catch (error) {
        // If the snap failed to respond, delete the promise to prevent a leak.
        this.#pendingRequests.delete(requestId);
        throw error;
      }
    })();

    // The snap can respond immediately if the request is not async. In that
    // case we must delete the promise to prevent a leak.
    if (!response.pending) {
      this.#pendingRequests.delete(requestId);
      return response.result;
    }

    // TODO: In the future, this should be handled by the UI. For now, we just
    // log the redirect information for debugging purposes.
    if (response.redirect?.message || response.redirect?.url) {
      const { message = '', url = '' } = response.redirect;
      console.log(
        `The snap requested a redirect: message="${message}", url="${url}"`,
      );
    }

    return promise.promise;
  }

  /**
   * Sign a transaction.
   *
   * @param address - Sender's address.
   * @param transaction - Transaction.
   * @param _opts - Transaction options (not used).
   */
  async signTransaction(
    address: string,
    transaction: TypedTransaction,
    _opts = {},
  ): Promise<Json | TypedTransaction> {
    const tx = toJson({
      ...transaction.toJSON(),
      from: address,
      type: `0x${transaction.type.toString(16)}`,
      chainId: bigIntToHex(transaction.common.chainId()),
    });

    const signedTx = await this.#submitRequest({
      address,
      method: EthMethod.SignTransaction,
      params: [tx],
    });

    // ! It's *** CRITICAL *** that we mask the signature here, otherwise the
    // ! snap could overwrite the transaction.
    const signature = mask(
      signedTx,
      object({
        r: string(),
        s: string(),
        v: string(),
      }),
    );

    return TransactionFactory.fromTxData({
      ...(tx as Record<string, Json>),
      ...signature,
    });
  }

  /**
   * Sign a typed data message.
   *
   * @param address - Signer's address.
   * @param data - Data to sign.
   * @param opts - Signing options.
   * @returns The signature.
   */
  async signTypedData(
    address: string,
    data: Record<string, unknown>[] | TypedDataV1 | TypedMessage<any>,
    opts = { version: SignTypedDataVersion.V1 },
  ): Promise<string> {
    const methods = {
      [SignTypedDataVersion.V1]: EthMethod.SignTypedDataV1,
      [SignTypedDataVersion.V3]: EthMethod.SignTypedDataV3,
      [SignTypedDataVersion.V4]: EthMethod.SignTypedDataV4,
    };

    // Use 'V1' by default to match other keyring implementations.
    const method = methods[opts.version] || EthMethod.SignTypedDataV1;
    const signature = await this.#submitRequest({
      address,
      method,
      params: toJson<Json[]>([address, data]),
    });

    return strictMask(signature, string());
  }

  /**
   * Sign a message.
   *
   * @param address - Signer's address.
   * @param hash - Data to sign.
   * @returns The signature.
   */
  async signMessage(address: string, hash: any): Promise<string> {
    const signature = await this.#submitRequest({
      address,
      method: EthMethod.Sign,
      params: toJson<Json[]>([address, hash]),
    });
    return strictMask(signature, string());
  }

  /**
   * Sign a personal message.
   *
   * Note: KeyringController says this should return a Buffer but it actually
   * expects a string.
   *
   * @param address - Signer's address.
   * @param data - Data to sign.
   * @returns Promise of the signature.
   */
  async signPersonalMessage(address: string, data: any): Promise<string> {
    const signature = await this.#submitRequest({
      address,
      method: EthMethod.PersonalSign,
      params: toJson<Json[]>([data, address]),
    });
    return strictMask(signature, string());
  }

  /**
   * Gets the private data associated with the given address so
   * that it may be exported.
   *
   * If this keyring contains duplicate public keys the first
   * matching address is exported.
   *
   * Used by the UI to export an account.
   *
   * @param _address - Address of the account to export.
   */
  exportAccount(_address: string): [Uint8Array, Json] | undefined {
    throw new Error('Exporting accounts from snaps is not supported.');
  }

  /**
   * Removes the account matching the given address.
   *
   * @param address - Address of the account to remove.
   */
  async removeAccount(address: string): Promise<void> {
    const { account, snapId } = this.#resolveAddress(address);

    // Always remove the account from the maps, even if the snap is going to
    // fail to delete it.
    this.#removeAccountFromMaps(account);

    try {
      await this.#snapClient.withSnapId(snapId).deleteAccount(account.id);
    } catch (error) {
      // If the snap failed to delete the account, log the error and continue
      // with the account deletion, otherwise the account will be stuck in the
      // keyring.
      console.error(
        `Account "${address}" may not have been removed from snap "${snapId}":`,
        error,
      );
    }
  }

  /**
   * Resolve an address to an account and snap ID.
   *
   * @param address - Address of the account to resolve.
   * @returns Account and snap ID. Throws if the account or snap ID is not
   * found.
   */
  #resolveAddress(address: string): {
    account: KeyringAccount;
    snapId: string;
  } {
    return {
      account: this.#addressToAccount.getOrThrow(address, 'Account'),
      snapId: this.#addressToSnapId.getOrThrow(address, 'Snap'),
    };
  }

  /**
   * Resolve a pending request.
   *
   * @param id - ID of the request to resolve.
   * @param result - Result of the request.
   */
  #resolveRequest(id: string, result: any): void {
    const promise = this.#pendingRequests.getOrThrow(id, 'Pending request');
    this.#pendingRequests.delete(id);
    promise.resolve(result);
  }

  /**
   * Reject a pending request.
   *
   * @param id - ID of the request to reject.
   */
  #rejectRequest(id: string): void {
    const promise = this.#pendingRequests.getOrThrow(id, 'Pending request');
    this.#pendingRequests.delete(id);
    promise.reject(new Error(`Request rejected by user or snap.`));
  }

  /**
   * Add an account to the internal maps.
   *
   * @param snapAccount - The account to be added.
   * @param snapId - The snap ID of the account.
   */
  #addAccountToMaps(snapAccount: KeyringAccount, snapId: string): void {
    const account = {
      ...snapAccount,
      // TODO: Do not convert the address to lowercase.
      //
      // This is a workaround to support the current UI which expects the
      // account address to be lowercase. This workaround should be removed
      // once we migrated the UI to use the account ID instead of the account
      // address.
      address: snapAccount.address.toLowerCase(),
    };
    this.#addressToAccount.set(account.address, account);
    this.#addressToSnapId.set(account.address, snapId);
  }

  /**
   * Remove an account from the internal maps.
   *
   * @param account - The account to be removed.
   */
  #removeAccountFromMaps(account: KeyringAccount): void {
    this.#addressToAccount.delete(account.address);
    this.#addressToSnapId.delete(account.address);
  }

  /**
   * Get an account by its ID. Returns undefined if the account is not found.
   *
   * @param id - Account ID.
   * @returns The account object or undefined if the account is not found.
   */
  #getAccountById(id: string): KeyringAccount | undefined {
    return [...this.#addressToAccount.values()].find(
      (account) => account.id === id,
    );
  }

  /**
   * Get the metadata of a snap keyring account.
   *
   * @param address - Account address.
   * @returns The snap metadata or undefined if the snap cannot be found.
   */
  #getSnapMetadata(
    address: string,
  ): InternalAccount['metadata']['snap'] | undefined {
    const snapId = this.#addressToSnapId.getOrThrow(address);
    const snap = this.#snapClient.getController().get(snapId);
    return snap
      ? { id: snapId, name: snap.manifest.proposedName, enabled: snap.enabled }
      : undefined;
  }

  /**
   * List all snap keyring accounts.
   *
   * @returns An array containing all snap keyring accounts.
   */
  async listAccounts(): Promise<InternalAccount[]> {
    return [...this.#addressToAccount.values()].map((account) => {
      const snap = this.#getSnapMetadata(account.address);
      return {
        ...account,
        // TODO: Do not convert the address to lowercase.
        //
        // This is a workaround to support the current UI which expects the
        // account address to be lowercase. This workaround should be removed
        // once we migrated the UI to use the account ID instead of the account
        // address.
        //
        // This is an extra step to ensure that the address is lowercase, it
        // shouldn't be necessary since the address is already converted to
        // lowercase when the account is added to the internal maps.
        address: account.address.toLowerCase(),
        metadata: {
          name: '',
          keyring: {
            type: this.type,
          },
          ...(snap && { snap }),
        },
      };
    });
  }
}
