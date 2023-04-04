/* eslint-disable id-denylist */
import {
  FeeMarketEIP1559Transaction,
  Transaction,
  TransactionFactory,
} from '@ethereumjs/tx';
import { HandlerType } from '@metamask/snaps-utils';
import { Json, JsonRpcNotification } from '@metamask/utils';
import { ethErrors } from 'eth-rpc-errors';
// eslint-disable-next-line import/no-nodejs-modules
// import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';

import { SnapKeyringErrors } from './errors';
import { DeferredPromise } from './util';

export const SNAP_KEYRING_TYPE = 'Snap Keyring';

export type SnapId = string; // Snap unique identifier
export type Address = string; // String public address
export type PublicKey = Uint8Array; // 33 or 64 byte public key
export type JsonWallet = [PublicKey, Json];
export type SnapWallet = Map<Address, SnapId>;

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
  [key: string]: string;
};

export class SnapKeyring {
  static type: string = SNAP_KEYRING_TYPE;

  type: string;

  protected addressToSnapId: SnapWallet;

  protected snapController: any;

  protected pendingRequests: Map<string, DeferredPromise<any>>;

  constructor() {
    this.type = SnapKeyring.type;
    this.addressToSnapId = new Map();
    this.pendingRequests = new Map();
  }

  // keyrings cant take constructor arguments so we
  // late-set the provider
  setController(snapController: any): void {
    this.snapController = snapController;
  }

  /**
   * Send a RPC request to a snap.
   *
   * @param snapId - Snap ID.
   * @param request - JSON-RPC request.
   * @param origin - Request's origin.
   * @param handler - Request handler.
   * @returns The RPC response.
   */
  protected async sendRequestToSnap(
    snapId: SnapId,
    request: JsonRpcNotification,
    origin = 'metamask',
    handler = HandlerType.OnRpcRequest,
  ): Promise<any> {
    return this.snapController.handleRequest({
      snapId,
      origin,
      handler,
      request,
    });
  }

  protected async sendSignatureRequestToSnap(
    snapId: SnapId,
    request: any,
  ): Promise<any> {
    console.log('[BRIDGE] snapId:', snapId);
    console.log('[BRIDGE] request:', JSON.stringify(request));
    try {
      return await this.sendRequestToSnap(snapId, {
        jsonrpc: '2.0',
        method: 'snap.keyring.approveRequest',
        params: request,
      });
    } catch (err) {
      console.log('sendSignatureRequest error', err);
      throw err;
    }
  }

  async handleKeyringSnapMessage(
    snapId: SnapId,
    message: any,
    // eslint-disable-next-line @typescript-eslint/ban-types
    saveSnapKeyring: Function,
  ): Promise<any> {
    const [methodName, params] = message;

    switch (methodName) {
      case 'create': {
        const address = params as Address;
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
        const address = params as Address;
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
    const output: SerializedWallets = {};
    for (const [address, snapId] of this.addressToSnapId.entries()) {
      output[address] = snapId;
    }
    return output;
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
    if (
      wallets &&
      typeof wallets === 'object' &&
      Object.keys(wallets).length > 0
    ) {
      for (const [address, snapId] of Object.entries(wallets)) {
        this.addressToSnapId.set(address, snapId);
      }
    }
  }

  /**
   * Get an array of public addresses.
   */
  async getAccounts(): Promise<Address[]> {
    return Array.from(this.addressToSnapId.keys());
  }

  /**
   * Sign a transaction.
   *
   * @param address - Sender's address.
   * @param tx - Transaction.
   * @param _opts - Transaction options (not used).
   */
  async signTransaction(
    address: Address,
    tx: Transaction | FeeMarketEIP1559Transaction,
    _opts = {},
  ) {
    const snapId = this.getSnapIdFromAddress(address);
    if (snapId === undefined) {
      throw new Error(`No snap found for address "${address}"`);
    }

    // Forward request to snap
    const id = uuidv4();
    // need to convert Transaction to serializable json to send to snap
    const serializedTx: Record<string, any> = tx.toJSON();

    // toJSON does not convert undefined to null, or removes that entry
    Object.entries(serializedTx).forEach(([key, _]) => {
      if (serializedTx[key] === undefined) {
        delete serializedTx[key];
      }
    });

    // this is to support EIP155 replay protection
    const chainOptions = {
      chainId: tx.common.chainIdBN().toNumber(),
      hardforks: [...tx.common.hardforks()],
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore private
      hardfork: tx.DEFAULT_HARDFORK,
      type: tx.type,
    };

    const serializedSignedTx = await this.sendSignatureRequestToSnap(snapId, {
      id,
      method: 'eth_sendTransaction',
      params: [serializedTx, address, chainOptions],
    });

    const signedTx = TransactionFactory.fromTxData(serializedSignedTx);

    return signedTx;
  }

  async signTypedData(
    address: Address,
    typedMessage: Record<string, unknown>[],
    params: any,
  ): Promise<string> {
    const snapId = this.getSnapIdFromAddress(address);
    if (snapId === undefined) {
      throw new Error(`No snap found for address "${address}"`);
    }

    // Forward request to snap
    const id = uuidv4();

    const serializedSignedTx = await this.sendSignatureRequestToSnap(snapId, {
      id,
      method: 'eth_signTypedData',
      params: [address, typedMessage, params],
    });

    return serializedSignedTx;
  }

  /**
   * Sign a message.
   *
   * @param _address - Signer's address.
   * @param _data - Data to sign.
   * @param _opts - Signing options.
   */
  async signMessage(_address: Address, _data: any, _opts = {}) {
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
    address: Address,
    data: any,
    _opts = {},
  ): Promise<string> {
    const snapId = this.getSnapIdFromAddress(address);
    if (snapId === undefined) {
      throw new Error(`No snap found for address "${address}"`);
    }

    // forward to snap
    const id = uuidv4();
    return await this.sendSignatureRequestToSnap(snapId, {
      id,
      method: 'personal_sign',
      params: [data, address],
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
  exportAccount(_address: Address): [PublicKey, Json] | undefined {
    throw new Error('snap-keyring: "exportAccount" not supported');
  }

  /**
   * Removes the first account matching the given public address.
   *
   * @param address - Address of the account to remove.
   */
  async removeAccount(address: Address): Promise<boolean> {
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
  listAccounts(snapId: SnapId): Address[] {
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
  createAccount(snapId: SnapId, address: Address): void {
    // the map key is case sensitive
    const lowerCasedAddress = address.toLowerCase();
    if (!this.addressToSnapId.has(lowerCasedAddress)) {
      this.addressToSnapId.set(lowerCasedAddress, snapId);
    }
  }

  /**
   * Delete the private data for an account belonging to a snap.
   *
   * @param address - Address to remove.
   * @returns True if the address existed before, false otherwise.
   */
  deleteAccount(address: Address): boolean {
    return this.addressToSnapId.delete(address);
  }

  deleteAccounts(snapId: SnapId): void {
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

  getSnapIdFromAddress(address: Address): SnapId {
    const snapId = this.addressToSnapId.get(address.toLowerCase());
    if (snapId === undefined) {
      throw new Error(`No snap found for address "${address}"`);
    }
    return snapId;
  }
}

/**
 * Decode a hex signature into a {r,s,v} object.
 *
 * @param signature - Signature in hexadecimal.
 * @returns The signature in a {r,s,v} object.
 */
function decodeSignature(signature: string): {
  r: string;
  s: string;
  v: number;
} {
  return {
    r: signature.slice(0, 66),
    s: `0x${signature.slice(66, 130)}`,
    v: parseInt(signature.slice(130, 132), 16),
  };
}
