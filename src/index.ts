/* eslint-disable id-denylist */
import { TransactionFactory, TypedTransaction } from '@ethereumjs/tx';
import { TypedDataV1, TypedMessage } from '@metamask/eth-sig-util';
import {
  KeyringSnapControllerClient,
  KeyringAccount,
  KeyringRequest,
} from '@metamask/keyring-api';
import { SnapController } from '@metamask/snaps-controllers';
import { Json } from '@metamask/utils';
import { ethErrors } from 'eth-rpc-errors';
// eslint-disable-next-line import/no-nodejs-modules
// import EventEmitter from 'events';
// eslint-disable-next-line import/no-nodejs-modules
import EventEmitter from 'events';
import { v4 as uuid } from 'uuid';

import { SnapKeyringErrors } from './errors';
import { DeferredPromise } from './util';

export const SNAP_KEYRING_TYPE = 'Snap Keyring';

// TODO: import from snap rpc
enum ManageAccountsOperation {
  ListAccounts = 'list',
  CreateAccount = 'create',
  ReadAccount = 'read',
  UpdateAccount = 'update',
  RemoveAccount = 'remove',
}

// Type for serialized format.
export type SerializedWallets = {
  snaps: string[];
};

export class SnapKeyring extends EventEmitter {
  static type: string = SNAP_KEYRING_TYPE;

  type: string;

  #snapClient: KeyringSnapControllerClient;

  #snapIds: string[];

  protected addressToAccount: Map<string, KeyringAccount>;

  protected addressToSnapId: Map<string, string>;

  protected pendingRequests: Map<string, DeferredPromise<any>>;

  constructor(controller: SnapController) {
    super();
    this.type = SnapKeyring.type;
    this.addressToSnapId = new Map();
    this.pendingRequests = new Map();
    this.#snapClient = new KeyringSnapControllerClient(controller);
  }

  async #syncAccounts(): Promise<void> {
    this.addressToAccount.clear();
    this.addressToSnapId.clear();

    for (const snapId of this.#snapIds) {
      const client = this.#snapClient.withSnapId(snapId);
      const accounts = await client.listAccounts();
      for (const account of accounts) {
        this.addressToAccount.set(account.address, account);
        this.addressToSnapId.set(account.address, snapId);
      }
    }
  }

  async handleKeyringSnapMessage(
    snapId: string,
    message: any,
    // eslint-disable-next-line @typescript-eslint/ban-types
    saveSnapKeyring: Function,
  ): Promise<any> {
    const [methodName, params] = message;

    switch (methodName) {
      case 'create': {
        const address = params as string;
        this.createAccount(snapId, address);
        await saveSnapKeyring();
        return null;
      }

      case 'read': {
        const accounts = this.listAccounts(snapId);
        return accounts;
      }

      // case 'update': {
      // }

      case 'delete': {
        const address = params as string;
        if (!address) {
          throw new Error('Missing account address');
        }

        const deleted = this.deleteAccount(address);
        if (deleted) {
          await saveSnapKeyring(address);
        }
        return deleted;
      }

      case 'submit': {
        const { id, result } = params;
        console.log('submit', id, result);
        this.submitSignatureRequestResult(id, result);
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
  async serialize(): Promise<SerializedWallets> {
    return {
      snaps: this.#snapIds,
    };
  }

  /**
   * Deserialize the given wallets into this keyring.
   *
   * This function is synchronous but uses an async signature
   * for consistency with other keyring implementations.
   *
   * @param wallets - Serialize wallets.
   */
  async deserialize(wallets: SerializedWallets): Promise<void> {
    this.#snapIds = wallets.snaps;
    await this.#syncAccounts();
  }

  /**
   * Get an array of public addresses.
   */
  async getAccounts(): Promise<string[]> {
    return Array.from(this.addressToSnapId.keys());
  }

  async #submitRequest(
    address: string,
    method: string,
    params?: Json | Json[],
  ) {
    // TODO:
    const snapId = this.addressToSnapId.get(address);
    const account = this.addressToAccount.get(address);

    if (snapId === undefined || account === undefined) {
      throw new Error(`Address not found: ${address}`);
    }

    const id = uuid();

    const response = await this.#snapClient.withSnapId(snapId).submitRequest({
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

    const promise = new DeferredPromise();
    this.pendingRequests.set(id, promise);
  }

  /**
   * Sign a transaction.
   *
   * @param address - Sender's address.
   * @param tx - Transaction.
   * @param _opts - Transaction options (not used).
   */
  async signTransaction(address: string, tx: TypedTransaction, _opts = {}) {
    const snapId = this.getSnapIdFromAddress(address);
    if (snapId === undefined) {
      throw new Error(`No snap found for address "${address}"`);
    }

    // Forward request to snap
    const id = uuid();
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

    const response = await this.#snapClient.withSnapId(snapId).submitRequest({
      account: '', // TODO: get account ID from address
      scope: '', // TODO: set scope according to selected chain
      request: {
        jsonrpc: '2.0',
        id,
        method: 'eth_sendTransaction',
        params: [address, serializedTx],
      },
    });

    if (!response.pending) {
      return TransactionFactory.fromTxData(response.result);
    }

    const signedTx = TransactionFactory.fromTxData(serializedSignedTx);

    return signedTx;
  }

  async signTypedData(
    address: string,
    typedMessage: Record<string, unknown>[] | TypedDataV1 | TypedMessage<any>,
    params: any = {},
  ): Promise<string> {
    const snapId = this.getSnapIdFromAddress(address);
    if (snapId === undefined) {
      throw new Error(`No snap found for address "${address}"`);
    }

    // Forward request to snap
    const account = this.addressToAccount.get(address);
    if (account === undefined) {
      throw new Error(`address not found: ${address}`);
    }

    const id = uuid();
    const response = await this.#snapClient
      .withSnapId(snapId)
      .submitRequest<string>({
        account: account.id,
        scope: '',
        request: {
          jsonrpc: '2.0',
          id,
          method: 'eth_signTypedData',
          params: JSON.parse(
            JSON.stringify([address, typedMessage, params]),
          ) as Json[],
        },
      });

    if (!response.pending) {
      return response.result;
    }

    return ''; // TODO: handle deferred promise
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
    const snapId = this.getSnapIdFromAddress(address);
    if (snapId === undefined) {
      throw new Error(`No snap found for address "${address}"`);
    }

    // forward to snap
    const id = uuid();
    return await this.sendSignatureRequestToSnap(snapId, {
      id,
      method: 'personal_sign',
      params: [address, data],
    });
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
    const snapId = this.getSnapIdFromAddress(address);
    if (!snapId) {
      throw new Error(SnapKeyringErrors.UnknownAccount);
    }

    await this.sendRequestToSnap(snapId, {
      jsonrpc: '2.0',
      method: ManageAccountsOperation.RemoveAccount,
      params: {},
    });
    this.addressToSnapId.delete(address);

    return true;
  }

  /* SNAP RPC METHODS */

  /**
   * List the accounts for a snap.
   *
   * @param snapId - Snap identifier.
   * @returns List of addresses for the given snap ID.
   */
  listAccounts(snapId: string): string[] {
    return Array.from(this.addressToSnapId.entries())
      .filter(([_, id]) => id === snapId)
      .map(([address, _]) => address);
  }

  /**
   * Create an account for a snap.
   *
   * The account is only created if the public address does not already exist.
   *
   * This checks for duplicates in the context of one snap but not across all
   * snaps. The keyring controller is responsible for checking for duplicates
   * across all addresses.
   *
   * @param snapId - Snap identifier.
   * @param address - Address.
   */
  createAccount(snapId: string, address: string): void {
    // the map key is case sensitive
    const lowerCasedAddress = address.toLowerCase();
    if (this.addressToSnapId.has(lowerCasedAddress)) {
      throw new Error(SnapKeyringErrors.AccountAlreadyExists);
    }
    this.addressToSnapId.set(lowerCasedAddress, snapId);
  }

  /**
   * Delete the private data for an account belonging to a snap.
   *
   * @param address - Address to remove.
   * @returns True if the address existed before, false otherwise.
   */
  deleteAccount(address: string): boolean {
    return this.addressToSnapId.delete(address);
  }

  deleteAccounts(snapId: string): void {
    const accounts = this.listAccounts(snapId);
    if (accounts.length === 0) {
      throw new Error(SnapKeyringErrors.UnknownSnapId);
    }

    for (const address of accounts) {
      this.addressToSnapId.delete(address);
    }
  }

  submitSignatureRequestResult(id: string, result: any): void {
    const signingPromise = this.pendingRequests.get(id);
    if (signingPromise?.resolve === undefined) {
      console.warn(
        'submitSignatureRequestResult missing requested id',
        id,
        result,
      );
      return;
    }
    this.pendingRequests.delete(id);
    signingPromise.resolve(result);
  }

  getSnapIdFromAddress(address: string): string {
    const snapId = this.addressToSnapId.get(address.toLowerCase());
    if (snapId === undefined) {
      throw new Error(`No snap found for address "${address}"`);
    }
    return snapId;
  }
}
