import { TransactionFactory, TypedTransaction } from '@ethereumjs/tx';
import { TypedDataV1, TypedMessage } from '@metamask/eth-sig-util';
import {
  KeyringSnapControllerClient,
  KeyringAccount,
  KeyringAccountStruct,
} from '@metamask/keyring-api';
import { SnapController } from '@metamask/snaps-controllers';
import { Json } from '@metamask/utils';
import EventEmitter from 'events';
import { assert, object, string, record, Infer } from 'superstruct';
import { v4 as uuid } from 'uuid';

import { SnapMessage, SnapMessageStruct } from './types';
import { DeferredPromise, strictMask, toJson, unique } from './util';

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

  #addressToAccount: Record<string, KeyringAccount>;

  #addressToSnapId: Record<string, string>;

  #pendingRequests: Record<string, DeferredPromise<any>>;

  constructor(controller: SnapController) {
    super();
    this.type = SnapKeyring.type;
    this.#snapClient = new KeyringSnapControllerClient({ controller });
    this.#addressToAccount = {};
    this.#addressToSnapId = {};
    this.#pendingRequests = {};
  }

  /**
   * Sync accounts from all snaps.
   *
   * @param extraSnapIds - List of extra snap IDs to include in the sync.
   */
  async #syncAccounts(...extraSnapIds: string[]): Promise<void> {
    // Add new snap IDs to the list.
    const snapIds = Object.values(this.#addressToSnapId).concat(extraSnapIds);

    // Remove all addresses from the maps.
    this.#addressToAccount = {};
    this.#addressToSnapId = {};

    // ... And add them back.
    for (const snapId of unique(snapIds)) {
      try {
        const accounts = await this.#snapClient
          .withSnapId(snapId)
          .listAccounts();
        for (const account of accounts) {
          this.#addressToAccount[account.address] = account;
          this.#addressToSnapId[account.address] = snapId;
        }
      } catch (error) {
        console.error(`Failed to sync accounts from snap "${snapId}":`, error);
      }
    }
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
      case 'deleteAccount':
      case 'createAccount': {
        await this.#syncAccounts(snapId);
        return null;
      }

      case 'listAccounts': {
        // Don't call the snap back to list the accounts. The main use case for
        // this method is to allow the snap to verify if the keyring's state is
        // in sync with the snap's state.
        return Object.values(this.#addressToAccount).filter(
          (account) => this.#addressToSnapId[account.address] === snapId,
        );
      }

      case 'submitResponse': {
        const { id, result } = params as any; // FIXME: add a struct for this
        this.#resolveRequest(id, result);
        return true;
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
      addressToAccount: this.#addressToAccount,
      addressToSnapId: this.#addressToSnapId,
    };
  }

  /**
   * Deserialize the keyring state into this keyring.
   *
   * @param state - Serialized keyring state.
   */
  async deserialize(state: KeyringState | undefined): Promise<void> {
    if (state === undefined) {
      return;
    }

    assert(state, KeyringStateStruct);
    this.#addressToAccount = state.addressToAccount;
    this.#addressToSnapId = state.addressToSnapId;
  }

  /**
   * Get the address of the accounts present in this keyring.
   *
   * @returns The list of account addresses.
   */
  getAccounts(): string[] {
    // *** DO NOT CALL THE SNAP HERE ***
    //
    // This method has to be synchronous because it is called by the UI, for
    // other use cases, use the `#listAccounts()` method instead.
    return unique(Object.keys(this.#addressToSnapId));
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
    const response = await this.#snapClient.withSnapId(snapId).submitRequest({
      account: account.id,
      scope: '', // Chain ID in CAIP-2 format.
      request: {
        jsonrpc: '2.0',
        id,
        method,
        ...(params !== undefined && { params }),
      },
    });

    if (!response.pending) {
      return response.result;
    }

    const promise = new DeferredPromise<Response>();
    this.#pendingRequests[id] = promise;
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
  ) {
    const tx = toJson({
      ...transaction.toJSON(),
      type: transaction.type,
      chainId: transaction.common.chainId().toString(),
    });

    const signedTx = await this.#submitRequest(address, 'eth_sendTransaction', [
      address,
      tx,
    ]);

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
    throw new Error('Exporting accounts from snaps is not supported');
  }

  /**
   * Removes the first account matching the given public address.
   *
   * @param address - Address of the account to remove.
   */
  async removeAccount(address: string): Promise<void> {
    const { account, snapId } = this.#resolveAddress(address);

    // FIXME: remove this hack and rely instead on the syncAccounts call below
    // once the removeAccount method is made async in the KeyringController.
    delete this.#addressToAccount[address];
    delete this.#addressToSnapId[address];

    await this.#snapClient.withSnapId(snapId).deleteAccount(account.id);
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
    const account = this.#addressToAccount[address];
    const snapId = this.#addressToSnapId[address];
    if (snapId === undefined || account === undefined) {
      throw new Error(`Account not found: ${address}`);
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
    const signingPromise = this.#pendingRequests[id];
    if (signingPromise?.resolve === undefined) {
      console.warn(`No pending request found for ID: ${id}`);
      return;
    }

    delete this.#pendingRequests[id];
    signingPromise.resolve(result);
  }
}
