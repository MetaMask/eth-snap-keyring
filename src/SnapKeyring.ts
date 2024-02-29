import type { TypedTransaction } from '@ethereumjs/tx';
import { TransactionFactory } from '@ethereumjs/tx';
import type { TypedDataV1, TypedMessage } from '@metamask/eth-sig-util';
import { SignTypedDataVersion } from '@metamask/eth-sig-util';
import type {
  EthBaseTransaction,
  EthBaseUserOperation,
  EthUserOperation,
  EthUserOperationPatch,
  InternalAccount,
  KeyringAccount,
} from '@metamask/keyring-api';
import {
  AccountCreatedEventStruct,
  AccountDeletedEventStruct,
  AccountUpdatedEventStruct,
  EthBaseUserOperationStruct,
  EthBytesStruct,
  EthMethod,
  EthUserOperationPatchStruct,
  KeyringEvent,
  RequestApprovedEventStruct,
  RequestRejectedEventStruct,
} from '@metamask/keyring-api';
import type { SnapController } from '@metamask/snaps-controllers';
import type { SnapId } from '@metamask/snaps-sdk';
import type { Json } from '@metamask/utils';
import { bigIntToHex } from '@metamask/utils';
import { EventEmitter } from 'events';
import { assert, mask, object, string } from 'superstruct';
import { v4 as uuid } from 'uuid';

import { toCaipChainId, CaipNamespaces } from './caip';
import { DeferredPromise } from './DeferredPromise';
import { KeyringSnapControllerClient } from './KeyringSnapControllerClient';
import { SnapIdMap } from './SnapIdMap';
import type { SnapMessage } from './types';
import { SnapMessageStruct } from './types';
import {
  equalsIgnoreCase,
  strictMask,
  throwError,
  toJson,
  unique,
} from './util';

export const SNAP_KEYRING_TYPE = 'Snap Keyring';

/**
 * Snap keyring state.
 *
 * This state is persisted by the keyring controller and passed to the snap
 * keyring when it's created.
 */
export type KeyringState = {
  accounts: Record<string, { account: KeyringAccount; snapId: SnapId }>;
};

/**
 * Snap keyring callbacks.
 *
 * These callbacks are used to interact with other components.
 */
export type SnapKeyringCallbacks = {
  saveState: () => Promise<void>;

  addressExists(address: string): Promise<boolean>;

  addAccount(
    address: string,
    snapId: SnapId,
    handleUserInput: (accepted: boolean) => Promise<void>,
  ): Promise<void>;

  removeAccount(
    address: string,
    snapId: SnapId,
    handleUserInput: (accepted: boolean) => Promise<void>,
  ): Promise<void>;

  redirectUser(snapId: SnapId, url: string, message: string): Promise<void>;
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
   * Mapping between account IDs and an object that contains the associated
   * account object and snap ID.
   */
  #accounts: SnapIdMap<{
    account: KeyringAccount;
    snapId: SnapId;
  }>;

  /**
   * Mapping between request IDs and their deferred promises.
   */
  #requests: SnapIdMap<{
    promise: DeferredPromise<any>;
    snapId: SnapId;
  }>;

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
    this.#requests = new SnapIdMap();
    this.#accounts = new SnapIdMap();
    this.#callbacks = callbacks;
  }

  /**
   * Handle an Account Created event from a snap.
   *
   * @param snapId - Snap ID.
   * @param message - Event message.
   * @returns `null`.
   */
  async #handleAccountCreated(
    snapId: SnapId,
    message: SnapMessage,
  ): Promise<null> {
    assert(message, AccountCreatedEventStruct);
    const { account } = message.params;

    // The UI still uses the account address to identify accounts, so we need
    // to block the creation of duplicate accounts for now to prevent accounts
    // from being overwritten.
    if (await this.#callbacks.addressExists(account.address.toLowerCase())) {
      throw new Error(`Account address '${account.address}' already exists`);
    }

    // A snap could try to create an account with a different address but with
    // an existing ID, so the above test only is not enough.
    if (this.#accounts.has(snapId, account.id)) {
      throw new Error(`Account '${account.id}' already exists`);
    }

    await this.#callbacks.addAccount(
      account.address.toLowerCase(),
      snapId,
      async (accepted: boolean) => {
        if (accepted) {
          this.#accounts.set(account.id, { account, snapId });
          await this.#callbacks.saveState();
        }
      },
    );
    return null;
  }

  /**
   * Handle an Account Updated event from a snap.
   *
   * @param snapId - Snap ID.
   * @param message - Event message.
   * @returns `null`.
   */
  async #handleAccountUpdated(
    snapId: SnapId,
    message: SnapMessage,
  ): Promise<null> {
    assert(message, AccountUpdatedEventStruct);
    const { account: newAccount } = message.params;
    const { account: oldAccount } =
      this.#accounts.get(snapId, newAccount.id) ??
      throwError(`Account '${newAccount.id}' not found`);

    // The address of the account cannot be changed. In the future, we will
    // support changing the address of an account since it will be required to
    // support UTXO-based chains.
    if (!equalsIgnoreCase(oldAccount.address, newAccount.address)) {
      throw new Error(`Cannot change address of account '${newAccount.id}'`);
    }

    this.#accounts.set(newAccount.id, { account: newAccount, snapId });
    await this.#callbacks.saveState();
    return null;
  }

  /**
   * Handle an Account Deleted event from a snap.
   *
   * @param snapId - Snap ID.
   * @param message - Event message.
   * @returns `null`.
   */
  async #handleAccountDeleted(
    snapId: SnapId,
    message: SnapMessage,
  ): Promise<null> {
    assert(message, AccountDeletedEventStruct);
    const { id } = message.params;
    const entry = this.#accounts.get(snapId, id);

    // We can ignore the case where the account was already removed from the
    // keyring, making the deletion idempotent.
    //
    // This happens when the keyring calls the snap to delete an account, and
    // the snap calls the keyring back with an `AccountDeleted` event.
    if (entry === undefined) {
      return null;
    }

    // At this point we know that the account exists, so we can safely
    // destructure it.
    const {
      account: { address },
    } = entry;

    await this.#callbacks.removeAccount(
      address.toLowerCase(),
      snapId,
      async (accepted) => {
        if (accepted) {
          await this.#callbacks.saveState();
        }
      },
    );
    return null;
  }

  /**
   * Handle an Request Approved event from a snap.
   *
   * @param snapId - Snap ID.
   * @param message - Event message.
   * @returns `null`.
   */
  async #handleRequestApproved(
    snapId: SnapId,
    message: SnapMessage,
  ): Promise<null> {
    assert(message, RequestApprovedEventStruct);
    const { id, result } = message.params;
    const { promise } =
      this.#requests.get(snapId, id) ?? throwError(`Request '${id}' not found`);

    this.#requests.delete(snapId, id);
    promise.resolve(result);
    return null;
  }

  /**
   * Handle an Request Rejected event from a snap.
   *
   * @param snapId - Snap ID.
   * @param message - Event message.
   * @returns `null`.
   */
  async #handleRequestRejected(
    snapId: SnapId,
    message: SnapMessage,
  ): Promise<null> {
    assert(message, RequestRejectedEventStruct);
    const { id } = message.params;
    const { promise } =
      this.#requests.get(snapId, id) ?? throwError(`Request '${id}' not found`);

    this.#requests.delete(snapId, id);
    promise.reject(new Error(`Request rejected by user or snap.`));
    return null;
  }

  /**
   * Handle a message from a snap.
   *
   * @param snapId - ID of the snap.
   * @param message - Message sent by the snap.
   * @returns The execution result.
   */
  async handleKeyringSnapMessage(
    snapId: SnapId,
    message: SnapMessage,
  ): Promise<Json> {
    assert(message, SnapMessageStruct);
    switch (message.method) {
      case KeyringEvent.AccountCreated: {
        return this.#handleAccountCreated(snapId, message);
      }

      case KeyringEvent.AccountUpdated: {
        return this.#handleAccountUpdated(snapId, message);
      }

      case KeyringEvent.AccountDeleted: {
        return this.#handleAccountDeleted(snapId, message);
      }

      case KeyringEvent.RequestApproved: {
        return this.#handleRequestApproved(snapId, message);
      }

      case KeyringEvent.RequestRejected: {
        return this.#handleRequestRejected(snapId, message);
      }

      default:
        throw new Error(`Method not supported: ${message.method}`);
    }
  }

  /**
   * Serialize the keyring state.
   *
   * @returns Serialized keyring state.
   */
  async serialize(): Promise<KeyringState> {
    return {
      accounts: this.#accounts.toObject(),
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
    this.#accounts = SnapIdMap.fromObject(state.accounts);
  }

  /**
   * Get the addresses of the accounts in this keyring.
   *
   * @returns The addresses of the accounts in this keyring.
   */
  async getAccounts(): Promise<string[]> {
    return unique(
      [...this.#accounts.values()].map(({ account }) =>
        account.address.toLowerCase(),
      ),
    );
  }

  /**
   * Get the addresses of the accounts associated with a given Snap.
   *
   * @param snapId - Snap ID to filter by.
   * @returns The addresses of the accounts associated with the given Snap.
   */
  async getAccountsBySnapId(snapId: SnapId): Promise<string[]> {
    return unique(
      [...this.#accounts.values()]
        .filter(({ snapId: accountSnapId }) => accountSnapId === snapId)
        .map(({ account }) => account.address.toLowerCase()),
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
    if (!account.methods.includes(method as EthMethod)) {
      throw new Error(
        `Method '${method}' not supported for account ${account.address}`,
      );
    }
    const requestId = uuid();

    // Create the promise before calling the snap to prevent a race condition
    // where the snap responds before we have a chance to create it.
    const promise = new DeferredPromise<Response>();
    this.#requests.set(requestId, { promise, snapId });

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
        this.#requests.delete(snapId, requestId);
        throw error;
      }
    })();

    // If the snap answers synchronously, the promise must be removed from the
    // map to prevent a leak.
    if (!response.pending) {
      this.#requests.delete(snapId, requestId);
      return response.result;
    }

    // If the snap answers asynchronously, we will inform the user with a redirect
    if (response.redirect?.message || response.redirect?.url) {
      const { message = '', url = '' } = response.redirect;
      await this.#callbacks.redirectUser(snapId, url, message);
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
    const chainId = transaction.common.chainId();
    const tx = toJson({
      ...transaction.toJSON(),
      from: address,
      type: `0x${transaction.type.toString(16)}`,
      chainId: bigIntToHex(chainId),
    });

    const signedTx = await this.#submitRequest({
      address,
      method: EthMethod.SignTransaction,
      params: [tx],
      chainId: toCaipChainId(CaipNamespaces.Eip155, `${chainId}`),
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

    // Use 'V1' by default to match other keyring implementations. V1 will be
    // used if the version is not specified or not supported.
    const method = methods[opts.version] || EthMethod.SignTypedDataV1;

    // Extract chain ID as if it was a typed message (as defined by EIP-712), if
    // input is not a typed message, then chain ID will be undefined!
    const chainId = (data as TypedMessage<any>).domain?.chainId;

    return strictMask(
      await this.#submitRequest({
        address,
        method,
        params: toJson<Json[]>([address, data]),
        ...(chainId === undefined
          ? {}
          : { chainId: toCaipChainId(CaipNamespaces.Eip155, `${chainId}`) }),
      }),
      EthBytesStruct,
    );
  }

  /**
   * Sign a message.
   *
   * @param address - Signer's address.
   * @param hash - Data to sign.
   * @returns The signature.
   */
  async signMessage(address: string, hash: any): Promise<string> {
    return strictMask(
      await this.#submitRequest({
        address,
        method: EthMethod.Sign,
        params: toJson<Json[]>([address, hash]),
      }),
      EthBytesStruct,
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
   * @returns Promise of the signature.
   */
  async signPersonalMessage(address: string, data: any): Promise<string> {
    return strictMask(
      await this.#submitRequest({
        address,
        method: EthMethod.PersonalSign,
        params: toJson<Json[]>([data, address]),
      }),
      EthBytesStruct,
    );
  }

  /**
   * Convert a base transaction to a base UserOperation.
   *
   * @param address - Address of the sender.
   * @param transactions - Base transactions to include in the UserOperation.
   * @returns A pseudo-UserOperation that can be used to construct a real.
   */
  async prepareUserOperation(
    address: string,
    transactions: EthBaseTransaction[],
  ): Promise<EthBaseUserOperation> {
    return strictMask(
      await this.#submitRequest({
        address,
        method: EthMethod.PrepareUserOperation,
        params: toJson<Json[]>(transactions),
      }),
      EthBaseUserOperationStruct,
    );
  }

  /**
   * Patches properties of a UserOperation. Currently, only the
   * `paymasterAndData` can be patched.
   *
   * @param address - Address of the sender.
   * @param userOp - UserOperation to patch.
   * @returns A patch to apply to the UserOperation.
   */
  async patchUserOperation(
    address: string,
    userOp: EthUserOperation,
  ): Promise<EthUserOperationPatch> {
    return strictMask(
      await this.#submitRequest({
        address,
        method: EthMethod.PatchUserOperation,
        params: toJson<Json[]>([userOp]),
      }),
      EthUserOperationPatchStruct,
    );
  }

  /**
   * Signs an UserOperation.
   *
   * @param address - Address of the sender.
   * @param userOp - UserOperation to sign.
   * @returns The signature of the UserOperation.
   */
  async signUserOperation(
    address: string,
    userOp: EthUserOperation,
  ): Promise<string> {
    return strictMask(
      await this.#submitRequest({
        address,
        method: EthMethod.SignUserOperation,
        params: toJson<Json[]>([userOp]),
      }),
      EthBytesStruct,
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
    this.#accounts.delete(snapId, account.id);

    try {
      await this.#snapClient.withSnapId(snapId).deleteAccount(account.id);
    } catch (error) {
      // If the snap failed to delete the account, log the error and continue
      // with the account deletion, otherwise the account will be stuck in the
      // keyring.
      console.error(
        `Account '${address}' may not have been removed from snap '${snapId}':`,
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
    snapId: SnapId;
  } {
    return (
      [...this.#accounts.values()].find(({ account }) =>
        equalsIgnoreCase(account.address, address),
      ) ?? throwError(`Account '${address}' not found`)
    );
  }

  /**
   * Get the metadata of a snap keyring account.
   *
   * @param snapId - Snap ID.
   * @returns The snap metadata or undefined if the snap cannot be found.
   */
  #getSnapMetadata(
    snapId: SnapId,
  ): InternalAccount['metadata']['snap'] | undefined {
    const snap = this.#snapClient.getController().get(snapId);
    return snap
      ? { id: snapId, name: snap.manifest.proposedName, enabled: snap.enabled }
      : undefined;
  }

  /**
   * Return an internal account object for a given address.
   *
   * @param address - Address of the account to return.
   * @returns An internal account object for the given address.
   */
  getAccountByAddress(address: string): InternalAccount | undefined {
    const accounts = this.listAccounts();
    return accounts.find(({ address: accountAddress }) =>
      equalsIgnoreCase(accountAddress, address),
    );
  }

  /**
   * List all snap keyring accounts.
   *
   * @returns An array containing all snap keyring accounts.
   */
  listAccounts(): InternalAccount[] {
    return [...this.#accounts.values()].map(({ account, snapId }) => {
      const snap = this.#getSnapMetadata(snapId);
      return {
        ...account,
        // TODO: Do not convert the address to lowercase.
        //
        // This is a workaround to support the current UI which expects the
        // account address to be lowercase. This workaround should be removed
        // once we migrated the UI to use the account ID instead of the account
        // address.
        address: account.address.toLowerCase(),
        metadata: {
          name: '',
          keyring: {
            type: this.type,
          },
          ...(snap !== undefined && { snap }),
        },
      };
    });
  }
}
