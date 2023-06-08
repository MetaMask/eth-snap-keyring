/* eslint-disable id-denylist */
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

type KeyringState = {
  addressToAccount: Record<string, KeyringAccount>;
  addressToSnapId: Record<string, string>;
};

export const SNAP_KEYRING_TYPE = 'Snap Keyring';

export class SnapKeyring extends EventEmitter {
  static type: string = SNAP_KEYRING_TYPE;

  type: string;

  #snapClient: KeyringSnapControllerClient;

  #addressToAccount: Map<string, KeyringAccount>;

  #addressToSnapId: Map<string, string>;

  #pendingRequests: Map<string, DeferredPromise<any>>;

  constructor(controller: SnapController) {
    super();
    this.type = SnapKeyring.type;
    this.#snapClient = new KeyringSnapControllerClient(controller);
    this.#addressToAccount = new Map();
    this.#addressToSnapId = new Map();
    this.#pendingRequests = new Map();
  }

  async #syncAccounts(): Promise<void> {
    // Create new maps instead of reusing the existing ones to prevent them
    // from being overwritten in case an exception is thrown during the sync.
    const addressToAccount = new Map<string, KeyringAccount>();
    const addressToSnapId = new Map<string, string>();

    for (const snapId of this.#addressToSnapId.values()) {
      const accounts = await this.#snapClient.withSnapId(snapId).listAccounts();
      for (const account of accounts) {
        addressToAccount.set(account.address, account);
        addressToSnapId.set(account.address, snapId);
      }
    }

    this.#addressToAccount = addressToAccount;
    this.#addressToSnapId = addressToSnapId;
  }

  async handleKeyringSnapMessage(
    snapId: string,
    message: any,
    // eslint-disable-next-line @typescript-eslint/ban-types
    saveSnapKeyring: Function,
  ): Promise<any> {
    console.log(
      `[BRIDGE] Received account management request: ${JSON.stringify(
        message,
      )}`,
    );
    const [methodName, params] = message;

    switch (methodName) {
      case 'update':
      case 'create':
      case 'delete': {
        await this.#syncAccounts();
        await saveSnapKeyring();
        return null;
      }

      case 'read': {
        return await this.#listAccounts(snapId);
      }

      case 'submit': {
        const { id, result } = params;
        console.log('submit', id, result);
        this.#submitSignatureRequestResult(id, result);
        return true;
      }

      default:
        throw ethErrors.rpc.invalidParams({
          message: 'Must specify a valid snap_manageAccounts "methodName".',
        });
    }
  }

  /**
   * Convert the wallets in this keyring to a serialized form
   * suitable for persistence.
   *
   * This function is synchronous but uses an async signature
   * for consistency with other keyring implementations.
   */
  async serialize(): Promise<KeyringState> {
    return {
      addressToSnapId: Object.fromEntries(this.#addressToSnapId),
      addressToAccount: Object.fromEntries(this.#addressToAccount),
    };
  }

  /**
   * Deserialize the given wallets into this keyring.
   *
   * This function is synchronous but uses an async signature
   * for consistency with other keyring implementations.
   *
   * @param state - Keyring state object.
   */
  async deserialize(state: KeyringState): Promise<void> {
    try {
      this.#addressToAccount = new Map(Object.entries(state.addressToAccount));
      this.#addressToSnapId = new Map(Object.entries(state.addressToSnapId));
    } catch (error) {
      console.warn('Cannot restore keyring state:', error);
    }
  }

  /**
   * Get an array of public addresses.
   *
   * @returns The list of account addresses.
   */
  getAccounts(): string[] {
    return Array.from(this.#addressToSnapId.keys());
  }

  async #submitRequest<Response extends Json>(
    address: string,
    method: string,
    params?: Json | Json[],
  ): Promise<Response> {
    const snapId = this.#addressToSnapId.get(address);
    const account = this.#addressToAccount.get(address);

    if (snapId === undefined || account === undefined) {
      throw new Error(`Address not found: ${address}`);
    }

    const id = uuid();
    const response = await this.#snapClient
      .withSnapId(snapId)
      .submitRequest<Response>({
        account: account.id,
        scope: '',
        request: {
          jsonrpc: '2.0',
          id,
          method,
          ...(params && { params }),
        },
      });

    if (!response.pending) {
      return response.result;
    }

    const promise = new DeferredPromise<Response>();
    this.#pendingRequests.set(id, promise);
    return promise.promise;
  }

  /**
   * Sign a transaction.
   *
   * @param address - Sender's address.
   * @param tx - Transaction.
   * @param _opts - Transaction options (not used).
   */
  async signTransaction(address: string, tx: TypedTransaction, _opts = {}) {
    // need to convert Transaction to serializable json to send to snap
    const serializedTx: Record<string, any> = tx.toJSON();

    // toJSON does not convert undefined to null, or removes that entry
    Object.entries(serializedTx).forEach(([key, _]) => {
      if (serializedTx[key] === undefined) {
        delete serializedTx[key];
      }
    });

    serializedTx.chainId = tx.common.chainId().toString() ?? '0x1';
    serializedTx.type = tx.type ?? '0x0'; // default to legacy

    const signedTx = await this.#submitRequest(address, 'eth_sendTransaction', [
      address,
      serializedTx,
    ]);

    return TransactionFactory.fromTxData(signedTx as any);
  }

  async signTypedData(
    address: string,
    typedMessage: Record<string, unknown>[] | TypedDataV1 | TypedMessage<any>,
    params: any = {},
  ): Promise<string> {
    return await this.#submitRequest(
      address,
      'eth_signTypedData',
      JSON.parse(JSON.stringify([address, typedMessage, params])) as Json[],
    );
  }

  /**
   * Sign a message.
   *
   * @param _address - Signer's address.
   * @param _data - Data to sign.
   * @param _opts - Signing options.
   */
  async signMessage(_address: string, _data: any, _opts = {}) {
    throw new Error('death to eth_sign!');
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
      JSON.parse(JSON.stringify([address, data])) as Json[],
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
  async removeAccount(address: string): Promise<boolean> {
    const account = this.#addressToAccount.get(address);
    const snapId = this.#addressToSnapId.get(address);
    if (snapId === undefined || account === undefined) {
      throw new Error(`Account not found: ${address}`);
    }

    await this.#snapClient.withSnapId(snapId).deleteAccount(account.id);
    this.#addressToSnapId.delete(address);
    this.#addressToAccount.delete(address);

    return true;
  }

  /* SNAP RPC METHODS */

  /**
   * List the accounts for a snap.
   *
   * @param snapId - Snap identifier.
   * @returns List of addresses for the given snap ID.
   */
  async #listAccounts(snapId: string): Promise<string[]> {
    const accounts = (
      await this.#snapClient.withSnapId(snapId).listAccounts()
    ).map((a) => a.address);
    console.log('[bridge] accounts list:', accounts);

    return (await this.#snapClient.withSnapId(snapId).listAccounts()).map(
      (a) => a.address,
    );
  }

  // /**
  //  * Create an account for a snap.
  //  *
  //  * The account is only created if the public address does not already exist.
  //  *
  //  * This checks for duplicates in the context of one snap but not across all
  //  * snaps. The keyring controller is responsible for checking for duplicates
  //  * across all addresses.
  //  *
  //  * @param _snapId - Snap identifier.
  //  * @param _address - Address.
  //  */
  // async createAccount(_snapId: string, _address: string): Promise<void> {
  //   await this.#syncAccounts();
  // }

  // /**
  //  * Delete the private data for an account belonging to a snap.
  //  *
  //  * @param _address - Address to remove.
  //  * @returns True if the address existed before, false otherwise.
  //  */
  // async deleteAccount(_address: string): Promise<void> {
  //   await this.#syncAccounts();
  // }

  // async deleteAccounts(_snapId: string): Promise<void> {
  //   await this.#syncAccounts();
  // }

  #submitSignatureRequestResult(id: string, result: any): void {
    const signingPromise = this.#pendingRequests.get(id);
    if (signingPromise?.resolve === undefined) {
      console.warn(
        'submitSignatureRequestResult missing requested id',
        id,
        result,
      );
      return;
    }
    this.#pendingRequests.delete(id);
    signingPromise.resolve(result);
  }
}
