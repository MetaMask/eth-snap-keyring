import { HandlerType } from '@metamask/snaps-utils';
import { Json } from '@metamask/utils';
import { ethErrors } from 'eth-rpc-errors';
import { v4 as uuidv4 } from 'uuid';

import { deferredPromise, DeferredPromise } from './util';

export const SNAP_KEYRING_TYPE = 'Snap Keyring';

export type Origin = string; // Origin of the snap
export type Address = string; // String public address
export type PublicKey = Uint8Array; // 33 or 64 byte public key
export type JsonWallet = [PublicKey, Json];
export type SnapWallet = Map<Address, Origin>;

type JsonRpcRequest = {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number | null;
};

// Type for serialized format.
export type SerializedWallets = {
  [key: string]: string;
};

class SnapKeyring {
  static type: string = SNAP_KEYRING_TYPE;

  type: string;

  protected addressToSnapId: SnapWallet;

  protected provider: any;

  protected snapController: any;

  protected pendingRequests: Map<string, DeferredPromise>;

  constructor() {
    this.type = SnapKeyring.type;
    this.addressToSnapId = new Map();
    this.pendingRequests = new Map();
  }

  // keyrings cant take constructor arguments so we
  // late-set the provider
  setProvider(provider: any, snapController: any) {
    this.provider = provider;
    this.snapController = snapController;
  }

  protected async sendRequestToSnap(
    snapId: Origin,
    request: JsonRpcRequest,
    origin = 'metamask',
    handler = HandlerType.OnRpcRequest,
  ): Promise<any> {
    console.log('setProvider', this.provider, this.snapController);
    return this.snapController.handleRequest({
      snapId,
      origin, // FIXME: handle the case when the request comes from another snap
      handler,
      request,
    });
  }

  protected async sendSignatureRequestToSnap(
    snapId: Origin,
    request: any,
  ): Promise<any> {
    console.log('sendSignatureRequest', snapId, request);
    const resP = this.sendRequestToSnap(snapId, {
      jsonrpc: '2.0',
      method: 'snap_keyring_sign_request',
      params: request,
    });
    console.log('sendSignatureRequest returned');

    try {
      const result = await resP;
      console.log('sendSignatureRequest resolved', result);
      return result;
    } catch (err) {
      console.log('sendSignatureRequest error', err);
      throw err;
    }
  }

  async handleKeyringSnapMessage(
    origin: Origin,
    message: any,
    saveSnapKeyring: Function,
  ): Promise<any> {
    const [methodName, params] = message;

    switch (methodName) {
      case 'create': {
        const address = params as Address;
        const added = this.createAccount(origin, address);
        if (added) {
          await saveSnapKeyring();
        }
        return added;
      }
      case 'read': {
        const accounts = this.listAccounts(origin);
        return accounts;
      }
      // case 'update': {

      // }
      case 'delete': {
        const address = params as Address;
        if (address) {
          const deleted = this.deleteAccount(address);
          if (deleted) {
            // include deleted address
            await saveSnapKeyring(address);
          }
          return deleted;
        }
        return;
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
    for (const [address, origin] of this.addressToSnapId.entries()) {
      output[address] = origin;
    }
    return output;
  }

  /**
   * Deserialize the given wallets into this keyring.
   *
   * This function is synchronous but uses an async signature
   * for consistency with other keyring implementations.
   *
   * @param wallets
   */
  async deserialize(wallets: SerializedWallets | undefined): Promise<void> {
    if (!wallets) {
      return;
    }
    for (const [address, origin] of Object.entries(wallets)) {
      this.addressToSnapId.set(address, origin);
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
   * @param address
   * @param tx
   * @param opts
   */
  async signTransaction(address: Address, tx: any, opts = {}) {
    const origin = this.addressToSnapId.get(address);
    if (origin === undefined) {
      throw new Error(`No origin found for address "${address}"`);
    }
    const id = uuidv4();
    const txParams = tx.toJSON();
    // forward to snap
    await this.sendSignatureRequestToSnap(origin, {
      id,
      method: 'eth_sendTransaction',
      params: [txParams],
    });
    const signingPromise = deferredPromise();
    console.log('new pending request', id);
    this.pendingRequests.set(id, signingPromise);
    // wait for signing to complete
    const sigHexString = (await signingPromise.promise) as unknown as string;
    const { v, r, s } = signatureHexStringToRsv(sigHexString);
    console.log('signTransaction', sigHexString);
    return tx._processSignature(v, r, s);
  }

  /**
   * Sign a message.
   *
   * @param address
   * @param data
   * @param opts
   */
  async signMessage(address: Address, data: any, opts = {}) {
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
    const origin = this.addressToSnapId.get(address);
    if (origin === undefined) {
      throw new Error(`No origin found for address "${address}"`);
    }

    // forward to snap
    const id = uuidv4();
    await this.sendSignatureRequestToSnap(origin, {
      id,
      method: 'personal_sign',
      params: [data, address],
    });

    const signingPromise = deferredPromise();
    console.log('new pending request', id);
    this.pendingRequests.set(id, signingPromise);

    // wait for signing to complete
    const sigHexString = (await signingPromise.promise) as unknown as string;
    console.log('signPersonalMessage', sigHexString);
    return sigHexString;
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
   * @param address
   */
  exportAccount(address: Address): [PublicKey, Json] | undefined {
    throw new Error('snap-keyring: "exportAccount" not supported');
  }

  /**
   * Removes the first account matching the given public address.
   *
   * @param address
   */
  removeAccount(address: Address): boolean {
    throw new Error('snap-keyring: "removeAccount" not supported');
  }

  /* SNAP RPC METHODS */

  /**
   * List the accounts for a snap origin.
   *
   * @param targetOrigin - Snap origin.
   * @returns List of addresses for the given origin.
   */
  listAccounts(targetOrigin: Origin): Address[] {
    return Array.from(this.addressToSnapId.entries())
      .filter(([_, origin]) => {
        return origin === targetOrigin;
      })
      .map(([address, _]) => {
        return address;
      });
  }

  /**
   * Create an account for a snap origin.
   *
   * The account is only created if the public address does not already exist.
   *
   * This checks for duplicates in the context of the snap origin but not
   * across all snaps. The keyring controller is responsible for checking for
   * duplicates across all addresses.
   *
   * @param origin - Origin.
   * @param address - Address.
   * @returns True if the account was created, false if it already existed.
   */
  createAccount(origin: Origin, address: string): boolean {
    const exists = this.addressToSnapId.has(address);
    if (!exists) {
      this.addressToSnapId.set(address, origin);
      return true;
    }
    return false;
  }

  // /**
  //  *  Read the private data for an account belonging to a snap origin.
  //  */
  // readAccount(origin: Origin, address: string): Json {
  //   const accounts = this._addressToOrigin.get(address);
  //   const value = accounts.find((v) => arrayEquals(v[0], address));
  //   if (value) {
  //     const [, privateData] = value;
  //     return privateData;
  //   }
  //   return null;
  // }

  // /**
  //  *  Update the private data for the account belonging to the snap origin.
  //  *
  //  *  The account must already exist.
  //  */
  // updateAccount(origin: Origin, _address: string, value: Json): boolean {
  //   const address = Buffer.from(_address, "hex");
  //   const accounts = this._addressToOrigin.get(origin) || [];
  //   const exists = accounts.find((v) => arrayEquals(v[0], address));
  //   if (exists) {
  //     exists[1] = value;
  //     return true;
  //   }
  //   return false;
  // }

  /**
   * Delete the private data for an account belonging to a snap origin.
   *
   * @param address - Address to remove.
   * @returns True if the address existed before, false otherwise.
   */
  deleteAccount(address: string): boolean {
    return this.addressToSnapId.delete(address);
  }

  deleteAccountsByOrigin(origin: Origin): void {
    for (const address of this.listAccounts(origin)) {
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
}

SnapKeyring.type = SNAP_KEYRING_TYPE;

export default SnapKeyring;

/**
 *
 * @param signatureHexString
 */
function signatureHexStringToRsv(signatureHexString: string) {
  // eslint-disable-next-line id-length
  const r = signatureHexString.slice(0, 66);
  // eslint-disable-next-line id-length
  const s = `0x${signatureHexString.slice(66, 130)}`;
  // eslint-disable-next-line id-length
  const v = parseInt(signatureHexString.slice(130, 132), 16);
  return { r, s, v };
}
