import { TransactionFactory, TypedTransaction } from '@ethereumjs/tx';
import { TypedDataV1, TypedMessage } from '@metamask/eth-sig-util';
import {
  KeyringSnapControllerClient,
  KeyringAccount,
} from '@metamask/keyring-api';
import { SnapController } from '@metamask/snaps-controllers';
import { Json } from '@metamask/utils';
import { ethErrors } from 'eth-rpc-errors';
// eslint-disable-next-line import/no-nodejs-modules
import EventEmitter from 'events';
import { v4 as uuid } from 'uuid';

import { DeferredPromise } from './util';

export const SNAP_KEYRING_TYPE = 'Snap Keyring';

type KeyringState = {
  addressToAccount: Record<string, KeyringAccount>;
  addressToSnapId: Record<string, string>;
};

/**
 * Remove duplicate entries from an array.
 *
 * @param array - Array to remove duplicates from.
 * @returns Array with duplicates removed.
 */
function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Convert a value to a valid JSON object.
 *
 * The function chains JSON.stringify and JSON.parse to ensure that the result
 * is a valid JSON object. In objects, undefined values are removed, and in
 * arrays, they are replaced with null.
 *
 * @param value - Value to convert to JSON.
 * @returns JSON representation of the value.
 */
function toJson<T extends Json = Json>(value: any): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

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
    this.#snapClient = new KeyringSnapControllerClient(controller);
    this.#addressToAccount = {};
    this.#addressToSnapId = {};
    this.#pendingRequests = {};
  }

  /**
   * Sync accounts from all snaps.
   *
   * @param extraSnapIds - List of extra snap IDs to include in the sync.
   */
  async #syncAccounts(extraSnapIds: string[] = []): Promise<void> {
    // Add new snap IDs to the list.
    const snapIds = extraSnapIds.concat(Object.values(this.#addressToSnapId));

    // Remove all addresses from the maps.
    this.#addressToAccount = {};
    this.#addressToSnapId = {};

    // ... And add them back.
    for (const snapId of unique(snapIds)) {
      const accounts = await this.#snapClient.withSnapId(snapId).listAccounts();
      for (const account of accounts) {
        this.#addressToAccount[account.address] = account;
        this.#addressToSnapId[account.address] = snapId;
      }
    }
  }

  /**
   * Handle a message from a snap.
   *
   * @param snapId - ID of the snap.
   * @param message - Message sent by the snap.
   * @param saveSnapKeyring - Function to save the snap's state.
   * @returns The execution result.
   */
  async handleKeyringSnapMessage(
    snapId: string,
    message: any,
    // eslint-disable-next-line @typescript-eslint/ban-types
    saveSnapKeyring: Function,
  ): Promise<Json> {
    console.log(
      `[BRIDGE] Received account management request: ${JSON.stringify(
        message,
      )}`,
    );
    const [method, params] = message;

    switch (method) {
      case 'update':
      case 'delete':
      case 'create': {
        await this.#syncAccounts([snapId]);
        await saveSnapKeyring();
        return null;
      }

      case 'read': {
        return await this.#listAccounts(snapId);
      }

      case 'submit': {
        const { id, result } = params;
        console.log('submit', id, result);
        this.#resolveRequest(id, result);
        return true;
      }

      default:
        throw ethErrors.rpc.invalidParams({
          message: 'Must specify a valid snap_manageAccounts "methodName".',
        });
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
  async deserialize(state: KeyringState): Promise<void> {
    try {
      this.#addressToAccount = state.addressToAccount;
      this.#addressToSnapId = state.addressToSnapId;
    } catch (error) {
      console.warn('Cannot restore keyring state:', error);
    }
  }

  /**
   * Get the address of the accounts present in this keyring.
   *
   * @returns The list of account addresses.
   */
  getAccounts(): string[] {
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
  ): Promise<Response> {
    const { account, snapId } = this.#resolveAddress(address);
    const id = uuid();
    const response = await this.#snapClient
      .withSnapId(snapId)
      .submitRequest<Response>({
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
    return await this.#submitRequest(
      address,
      'eth_signTypedData',
      toJson<Json[]>([address, data, opts]),
    );
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
    return await this.#submitRequest(
      address,
      'eth_sign',
      toJson<Json[]>([address, data, opts]),
    );
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
    return await this.#submitRequest(
      address,
      'personal_sign',
      toJson<Json[]>([address, data]),
    );
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
    throw new Error('snap-keyring: "exportAccount" not supported');
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
    await this.#syncAccounts();
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
   * List the accounts for a snap.
   *
   * @param snapId - ID of the snap.
   * @returns List of addresses for the given snap ID.
   */
  async #listAccounts(snapId: string): Promise<string[]> {
    return (await this.#snapClient.withSnapId(snapId).listAccounts()).map(
      (a) => a.address,
    );
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
