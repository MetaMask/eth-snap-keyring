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

/**
 * Snap keyring state.
 *
 * This state is persisted by the keyring controller and passed to the snap
 * keyring when it's created.
 */
export type KeyringState = Infer<typeof KeyringStateStruct>;

/**
 * Snap keyring callbacks.
 *
 * These callbacks are used to interact with other components.
 */
export type SnapKeyringCallbacks = {
  saveState: () => Promise<void>;
  removeAccount(address: string): Promise<void>;
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

  #addressToAccount: CaseInsensitiveMap<KeyringAccount>;

  #addressToSnapId: CaseInsensitiveMap<string>;

  #pendingRequests: CaseInsensitiveMap<DeferredPromise<any>>;

  /**
   * Callbacks used to interact with other components.
   */
  #callbacks: SnapKeyringCallbacks;

  /**
   * Create a new snap keyring.
   *
   * @param controller - Snaps controller.
   * @param callbacks - Callbacks used to interact with other components.
   * @returns A new snap keyring.
   */
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
      case KeyringEvent.AccountCreated:
      case KeyringEvent.AccountUpdated: {
        await this.#syncAllSnapsAccounts(snapId);
        await this.#callbacks.saveState();
        return null;
      }

      case KeyringEvent.AccountDeleted: {
        const { id } = params as any;
        const account = this.#getAccountById(id);

        // We can ignore the case where the account was already removed from
        // the keyring.
        //
        // This happens when the keyring calls the snap to delete an account,
        // and the snap responds with an AccountDeleted event.
        if (account !== undefined) {
          await this.#callbacks.removeAccount(account.address);
        }

        return null;
      }

      case KeyringEvent.RequestApproved: {
        const { id, result } = params as any;
        this.#resolveRequest(id, result);
        return null;
      }

      case KeyringEvent.RequestRejected: {
        const { id } = params as any;
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
   * Get the address of the accounts present in this keyring.
   *
   * @returns The list of account addresses.
   */
  async getAccounts(): Promise<string[]> {
    // Do not call the snap here. This method is called by the UI, keep it
    // _fast_.
    return unique(
      [...this.#addressToAccount.values()].map((account) => account.address),
    );
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

    // If the snap answers synchronously, the promise must be removed from the
    // map to prevent a leak.
    if (!response.pending) {
      this.#pendingRequests.delete(requestId);
      return response.result;
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
      r: signature.r,
      s: signature.s,
      v: signature.v,
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
   * Syncs all accounts from all snaps.
   *
   * @param extraSnapIds - Extra snap IDs to sync accounts for.
   */
  async #syncAllSnapsAccounts(...extraSnapIds: string[]): Promise<void> {
    const snapIds = extraSnapIds.concat(...this.#addressToSnapId.values());
    for (const snapId of unique(snapIds)) {
      try {
        await this.#syncSnapAccounts(snapId);
      } catch (error) {
        // Log the error and continue with the other snaps.
        console.error(`Failed to sync accounts for snap '${snapId}':`, error);
      }
    }
  }

  /**
   * Syncs all accounts for a snap.
   *
   * @param snapId - ID of the snap to sync accounts for.
   */
  async #syncSnapAccounts(snapId: string): Promise<void> {
    // Get new accounts first, before removing the old ones. This way, if
    // something goes wrong, we don't lose the old accounts.
    const oldAccounts = this.#getAccountsBySnapId(snapId);
    const newAccounts = await this.#snapClient
      .withSnapId(snapId)
      .listAccounts();

    // Remove the old accounts from the maps.
    for (const account of oldAccounts) {
      this.#removeAccountFromMaps(account);
    }

    // Add the new accounts to the maps.
    for (const account of newAccounts) {
      this.#addAccountToMaps(account, snapId);
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
   * Get all accounts associated with a snap ID.
   *
   * @param snapId - The snap ID to get accounts for.
   * @returns All accounts associated with the given snap ID.
   */
  #getAccountsBySnapId(snapId: string): KeyringAccount[] {
    return [...this.#addressToAccount.values()].filter(
      (account) => this.#addressToSnapId.get(account.address) === snapId,
    );
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
      // FIXME: Do not lowercase the address here. This is a workaround to
      // support the current UI which expects the account address to be
      // lowercase. This workaround should be removed once we migrated the UI
      // to use the account ID instead of the account address.
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
    return [...this.#addressToAccount.values()].filter(
      (account) => account.id === id,
    )[0];
  }

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
    await this.#syncAllSnapsAccounts();
    return [...this.#addressToAccount.values()].map((account) => {
      const snap = this.#getSnapMetadata(account.address);
      return {
        ...account,
        // FIXME: Do not lowercase the address here. This is a workaround to
        // support the current UI which expects the account address to be
        // lowercase. This workaround should be removed once we migrated the UI
        // to use the account ID instead of the account address.
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
