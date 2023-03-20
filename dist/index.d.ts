/// <reference types="node" />
import { Json } from '@metamask/utils';
import { Buffer } from 'buffer';
import { DeferredPromise } from './util';
export declare const type = "Snap Keyring";
export declare type Origin = string;
export declare type Address = string;
export declare type PublicKey = Buffer;
export declare type JsonWallet = [PublicKey, Json];
export declare type SnapWallet = Map<Address, Origin>;
export declare type SerializedWallets = {
    [key: string]: string;
};
declare class SnapKeyring {
    static type: string;
    type: string;
    _addressToOrigin: SnapWallet;
    _provider: any;
    _snapController: any;
    _pendingRequests: Map<string, DeferredPromise>;
    constructor();
    setProvider(provider: any, snapController: any): void;
    sendRequestToSnap(origin: Origin, request: any): Promise<any>;
    sendSignatureRequestToSnap(origin: Origin, request: any): Promise<any>;
    handleKeyringSnapMessage(origin: Origin, message: any, saveSnapKeyring: Function): Promise<any>;
    /**
     * Convert the wallets in this keyring to a serialized form
     * suitable for persistence.
     *
     * This function is synchronous but uses an async signature
     * for consistency with other keyring implementations.
     */
    serialize(): Promise<SerializedWallets>;
    /**
     * Deserialize the given wallets into this keyring.
     *
     * This function is synchronous but uses an async signature
     * for consistency with other keyring implementations.
     *
     * @param wallets
     */
    deserialize(wallets: SerializedWallets | undefined): Promise<void>;
    /**
     * Get an array of public addresses.
     */
    getAccounts(): Promise<Address[]>;
    /**
     * Sign a transaction.
     *
     * @param address
     * @param tx
     * @param opts
     */
    signTransaction(address: Address, tx: any, opts?: {}): Promise<any>;
    /**
     * Sign a message.
     *
     * @param address
     * @param data
     * @param opts
     */
    signMessage(address: Address, data: any, opts?: {}): Promise<void>;
    /**
     * Sign a message.
     *
     * @param address
     * @param data
     * @param opts
     */
    signPersonalMessage(address: Address, data: any, opts?: {}): Promise<string>;
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
    exportAccount(address: Address): [PublicKey, Json] | undefined;
    /**
     * Removes the first account matching the given public address.
     *
     * @param address
     */
    removeAccount(address: Address): boolean;
    /**
     * List the accounts for a snap origin.
     *
     * @param targetOrigin
     */
    listAccounts(targetOrigin: Origin): Address[];
    /**
     * Create an account for a snap origin.
     *
     * The account is only created if the public address does not
     * already exist.
     *
     * This checks for duplicates in the context of the snap origin but
     * not across all snaps. The keyring controller is responsible for checking
     * for duplicates across all addresses.
     *
     * @param origin
     * @param address
     */
    createAccount(origin: Origin, address: string): boolean;
    /**
     * Delete the private data for an account belonging to a snap origin.
     *
     * @param address
     */
    deleteAccount(address: string): boolean;
    deleteAccountsByOrigin(origin: Origin): void;
    submitSignatureRequestResult(id: string, result: any): void;
}
export default SnapKeyring;
