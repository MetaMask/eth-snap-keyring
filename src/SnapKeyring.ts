import { TransactionFactory, TypedTransaction } from '@ethereumjs/tx';
import { TypedDataV1, TypedMessage } from '@metamask/eth-sig-util';
import {
  KeyringSnapControllerClient,
  KeyringAccount,
  KeyringAccountStruct,
} from '@metamask/keyring-api';
import { SnapController } from '@metamask/snaps-controllers';
import { Json } from '@metamask/utils';
import { EventEmitter } from 'events';
import { assert, object, string, record, Infer } from 'superstruct';
import { v4 as uuid } from 'uuid';

import { CaseInsensitiveMap } from './CaseInsensitiveMap';
import { DeferredPromise } from './DeferredPromise';
import { InternalAccount, SnapMessage, SnapMessageStruct } from './types';
import { strictMask, toJson, unique } from './util';

export const SNAP_KEYRING_TYPE = 'Snap Keyring';

export const KeyringStateStruct = object({
  addressToAccount: record(string(), KeyringAccountStruct),
  addressToSnapId: record(string(), string()),
});

export type KeyringState = Infer<typeof KeyringStateStruct>;

/**
 * Keyring bridge implementation to support snaps.
 */
export class SnapKeyring extends EventEmitter {
  static type: string = SNAP_KEYRING_TYPE;

  type: string;

  #snapClient: KeyringSnapControllerClient;

  #addressToAccount: CaseInsensitiveMap<KeyringAccount>;

  #addressToSnapId: CaseInsensitiveMap<string>;

  #pendingRequests: CaseInsensitiveMap<DeferredPromise<any>>;

  constructor(controller: SnapController) {
    super();
    this.type = SnapKeyring.type;
    this.#snapClient = new KeyringSnapControllerClient({ controller });
    this.#addressToAccount = new CaseInsensitiveMap();
    this.#addressToSnapId = new CaseInsensitiveMap();
    this.#pendingRequests = new CaseInsensitiveMap();
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
      case 'updateAccount':
      case 'createAccount':
      case 'deleteAccount': {
        await this.#syncAllSnapsAccounts(snapId);
        return null;
      }

      case 'listAccounts': {
        // Don't call the snap back to list the accounts. The main use case for
        // this method is to allow the snap to verify if the keyring's state is
        // in sync with the snap's state.
        return [...this.#addressToAccount.values()].filter(
          (account) => this.#addressToSnapId.get(account.address) === snapId,
        );
      }

      case 'submitResponse': {
        const { id, result } = params as any; // FIXME: add a struct for this
        this.#resolveRequest(id, result);
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
   * @param address - Account address.
   * @param method - Method to call.
   * @param params - Method parameters.
   * @returns Promise that resolves to the result of the method call.
   */
  async #submitRequest<Response extends Json>(
    address: string,
    method: string,
    params?: Json | Json[],
  ): Promise<Json> {
    const { account, snapId } = this.#resolveAddress(address);
    const id = uuid();

    // Create the promise before calling the snap to prevent a race condition
    // where the snap responds before we have a chance to create it.
    const promise = new DeferredPromise<Response>();
    this.#pendingRequests.set(id, promise);

    const response = await (async () => {
      try {
        return await this.#snapClient.withSnapId(snapId).submitRequest({
          account: account.id,
          scope: '', // Chain ID in CAIP-2 format.
          request: {
            jsonrpc: '2.0',
            id,
            method,
            ...(params !== undefined && { params }),
          },
        });
      } catch (error) {
        // If the snap failed to respond, delete the promise to prevent a leak.
        this.#pendingRequests.delete(id);
        throw error;
      }
    })();

    // The snap can respond immediately if the request is not async. In that
    // case we should delete the promise to prevent a leak.
    if (!response.pending) {
      this.#pendingRequests.delete(id);
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
      type: transaction.type,
      chainId: transaction.common.chainId().toString(),
    });

    const signedTx = await this.#submitRequest(address, 'eth_sendTransaction', [
      address,
      tx,
    ]);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (signedTx?.userOp) {
      return signedTx;
    }
    return TransactionFactory.fromTxData(signedTx as any);
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
    opts: any = {},
  ): Promise<string> {
    const signature = await this.#submitRequest(
      address,
      'eth_signTypedData',
      toJson<Json[]>([address, data, opts]),
    );
    return strictMask(signature, string());
  }

  /**
   * Sign a message.
   *
   * @param address - Signer's address.
   * @param data - Data to sign.
   * @param opts - Signing options.
   * @returns The signature.
   */
  async signMessage(address: string, data: any, opts = {}): Promise<string> {
    const signature = await this.#submitRequest(
      address,
      'eth_sign',
      toJson<Json[]>([address, data, opts]),
    );
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
   * @param _opts - Unused options.
   * @returns Promise of the signature.
   */
  async signPersonalMessage(
    address: string,
    data: any,
    _opts = {},
  ): Promise<string> {
    const signature = await this.#submitRequest(
      address,
      'personal_sign',
      toJson<Json[]>([address, data]),
    );
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
        console.error(`Failed to sync accounts for snap "${snapId}":`, error);
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

    console.log('snapId', snapId);
    console.log('oldAccounts', oldAccounts);
    console.log('newAccounts', newAccounts);

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
    const account = this.#addressToAccount.get(address);
    const snapId = this.#addressToSnapId.get(address);
    if (snapId === undefined || account === undefined) {
      throw new Error(`Account address not found: ${address}`);
    }
    return { account, snapId };
  }

  /**
   * Resolve a pending request.
   *
   * @param id - ID of the request to resolve.
   * @param result - Result of the request.
   */
  #resolveRequest(id: string, result: any): void {
    const promise = this.#pendingRequests.get(id);
    if (promise?.resolve === undefined) {
      throw new Error(`No pending request found for ID: ${id}`);
    }

    this.#pendingRequests.delete(id);
    promise.resolve(result);
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
   * @param account - The account to be added.
   * @param snapId - The snap ID of the account.
   */
  #addAccountToMaps(account: KeyringAccount, snapId: string): void {
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
   * List all accounts.
   *
   * @param sync - Whether to sync accounts with the snaps.
   * @returns All accounts.
   */
  async listAccounts(sync: boolean): Promise<InternalAccount[]> {
    if (sync) {
      await this.#syncAllSnapsAccounts();
    }
    return [...this.#addressToAccount.values()].map((account) => {
      return {
        ...account,
        metadata: {
          snap: {
            id: this.#addressToSnapId.get(account.address),
          },
          keyring: {
            type: this.type,
          },
        },
      };
    });
  }
}
