import { TransactionFactory, TypedTransaction } from '@ethereumjs/tx';
import {
  personalSign,
  recoverTypedSignature,
  SignTypedDataVersion,
} from '@metamask/eth-sig-util';
import { HandlerType } from '@metamask/snaps-utils';

import { SnapKeyring } from '.';
import { SnapKeyringErrors } from './errors';

jest.mock('uuid', () => ({ v4: () => 'testId' }));
const mockHandleRequest = jest.fn().mockResolvedValue(1);
const mockSnapController = {
  handleRequest: mockHandleRequest,
};
describe('SnapKeyring', () => {
  let snapKeyring: SnapKeyring;

  const mockAddress = '0x1c96099350f13d558464ec79b9be4445aa0ef579';
  const mockAddress2 =
    '0xfa814753a741d3a4998de68b693b61ffb65593486f50673b75ced1dc555eebeb';
  const mockCAIP10Account = `eip155:1:${mockAddress}`.toLowerCase();
  const mockCAIP10Account2 = `eip155:2:${mockAddress2}`.toLowerCase();
  const mockSnapId = 'mockSnapId';
  const mockSnapId2 = 'mockSnapId2';

  beforeEach(() => {
    snapKeyring = new SnapKeyring();
    snapKeyring.setController(mockSnapController);
  });

  it('setController returns', () => {
    const localSnapKeyring = new SnapKeyring();
    expect(() =>
      localSnapKeyring.setController(mockSnapController),
    ).not.toThrow();
  });

  describe('handleKeyringSnapMessage', () => {
    // do nothing
  });

  it('serializes SnapKeyring', async () => {
    snapKeyring.createAccount(mockSnapId, mockCAIP10Account);

    const serializedSnapKeyring = await snapKeyring.serialize();

    expect(serializedSnapKeyring).toStrictEqual({
      [mockCAIP10Account]: mockSnapId,
    });
  });

  describe('deserialize', () => {
    it('deserializes successfully', async () => {
      const mockWallet = {
        [mockCAIP10Account]: mockSnapId,
      };

      await snapKeyring.deserialize(mockWallet);
      const accounts = await snapKeyring.getAccounts();
      expect(accounts).toStrictEqual([mockCAIP10Account]);
    });

    it('fails to deserialize when empty wallet is provided', async () => {
      const badWallet = {};

      await expect(snapKeyring.deserialize(badWallet)).rejects.toThrow(
        SnapKeyringErrors.MissingWallet,
      );

      const retrievedWallets = await snapKeyring.getAccounts();
      expect(retrievedWallets).toStrictEqual([]);
    });

    it('fails to deserialize when undefined is provided', async () => {
      // @ts-expect-error Testing when undefined is passed into deserialize
      await expect(snapKeyring.deserialize(null)).rejects.toThrow(
        SnapKeyringErrors.MissingWallet,
      );

      const retrievedWallets = await snapKeyring.getAccounts();
      expect(retrievedWallets).toStrictEqual([]);
    });
  });

  describe('getAccounts', () => {
    it('retrieves accounts when calling getAccount', async () => {
      const mockWallet = {
        [mockCAIP10Account]: mockSnapId,
      };
      await snapKeyring.deserialize(mockWallet);
      const accounts = await snapKeyring.getAccounts();
      expect(accounts).toStrictEqual([mockCAIP10Account]);
    });

    it('retrieves accounts when there are accounts from different snap ids', async () => {
      const mockWallet = {
        [mockCAIP10Account]: mockSnapId,
        [mockCAIP10Account2]: mockSnapId2,
      };
      await snapKeyring.deserialize(mockWallet);
      const accounts = await snapKeyring.getAccounts();
      expect(accounts).toStrictEqual([mockCAIP10Account, mockCAIP10Account2]);
    });
  });

  // describe('exportAccount', () => {
  //   it('exports account', () => {

  //   })
  // })
  // })

  describe.skip('removeAccount', () => {
    beforeEach(() => {
      snapKeyring.createAccount(mockSnapId, mockCAIP10Account);
    });

    it('removes account', async () => {
      mockHandleRequest.mockResolvedValue(true);
      const removalResult = snapKeyring.removeAccount(mockCAIP10Account);

      expect(removalResult).toBe(true);
      expect(mockSnapController).toHaveBeenCalledTimes(1);
      expect(mockSnapController).toHaveBeenCalledWith({});
    });

    it("throws error when trying to remove an account that doesn't exist", async () => {
      await expect(
        snapKeyring.removeAccount(mockCAIP10Account),
      ).rejects.toThrow(SnapKeyringErrors.UnknownAccount);
      expect(mockSnapController).toHaveBeenCalledTimes(0);
    });

    it('throws error if snap rejected the call', async () => {
      mockHandleRequest.mockRejectedValue('snapError');
      const removalResult = snapKeyring.removeAccount(mockCAIP10Account);

      await expect(removalResult).rejects.toThrow('snapError');

      // check if account was removed
      const accounts = await snapKeyring.getAccounts();
      expect(accounts).toStrictEqual([mockCAIP10Account]);
    });
  });

  it('lists accounts only from one snapId', () => {
    snapKeyring.createAccount(mockSnapId, mockCAIP10Account);
    snapKeyring.createAccount(mockSnapId2, mockCAIP10Account2);

    const listAccounts = snapKeyring.listAccounts(mockSnapId);
    expect(listAccounts).toStrictEqual([mockCAIP10Account]);
  });

  describe('createAccount', () => {
    it('creates account', async () => {
      snapKeyring.createAccount(mockSnapId, mockCAIP10Account);

      const accounts = await snapKeyring.getAccounts();
      expect(accounts).toStrictEqual([mockCAIP10Account]);
    });

    it('throws if an account with the same address is entered', () => {
      snapKeyring.createAccount(mockSnapId, mockCAIP10Account);
      expect(() =>
        snapKeyring.createAccount(mockSnapId2, mockCAIP10Account),
      ).toThrow(SnapKeyringErrors.AccountAlreadyExists);
    });
  });

  describe('deleteAccount', () => {
    beforeEach(() => {
      snapKeyring.createAccount(mockSnapId, mockCAIP10Account);
    });

    it('deletes an account', async () => {
      const deleteResult = snapKeyring.deleteAccount(mockCAIP10Account);
      expect(deleteResult).toBe(true);

      const accounts = await snapKeyring.getAccounts();
      expect(accounts).toStrictEqual([]);
    });

    it('deletes an unknown account should return false', async () => {
      const deleteResult = snapKeyring.deleteAccount(mockCAIP10Account2);
      expect(deleteResult).toBe(false);

      const accounts = await snapKeyring.getAccounts();
      expect(accounts).toStrictEqual([mockCAIP10Account]);
    });
  });

  describe('deleteAccountByOrigin', () => {
    const mockCAIP10Account3 =
      'eip155:1:0x9862D074e33003726fA05c74F0142995f33A3250'.toLowerCase();
    const mockCAIP10Account4 =
      'eip155:1:0x650Ab9303424bb854Ff86B1325067e23167264Ac'.toLowerCase();
    const mockCAIP10Account5 =
      'eip155:1:0xa76765C44767da8107f6A33e44A1D828F1438919'.toLowerCase();
    beforeEach(() => {
      snapKeyring.createAccount(mockSnapId, mockCAIP10Account);
      snapKeyring.createAccount(mockSnapId, mockCAIP10Account2);

      snapKeyring.createAccount(mockSnapId2, mockCAIP10Account3);
      snapKeyring.createAccount(mockSnapId2, mockCAIP10Account4);
      snapKeyring.createAccount(mockSnapId2, mockCAIP10Account5);
    });

    it('deletes all the accounts by snapId', async () => {
      expect(() => snapKeyring.deleteAccounts(mockSnapId)).not.toThrow();

      const accounts = snapKeyring.listAccounts(mockSnapId);
      expect(accounts).toStrictEqual([]);

      const accountsOfAnotherSnapId = snapKeyring.listAccounts(mockSnapId2);
      expect(accountsOfAnotherSnapId).toStrictEqual([
        mockCAIP10Account3,
        mockCAIP10Account4,
        mockCAIP10Account5,
      ]);
    });

    it('deletes an unknown account should throw and not delete any accounts', async () => {
      expect(() => snapKeyring.deleteAccounts('unknown snap id')).toThrow(
        SnapKeyringErrors.UnknownSnapId,
      );

      const accounts = await snapKeyring.getAccounts();
      expect(accounts).toStrictEqual([
        mockCAIP10Account,
        mockCAIP10Account2,
        mockCAIP10Account3,
        mockCAIP10Account4,
        mockCAIP10Account5,
      ]);
    });
  });
  describe('sign transaction', () => {
    beforeEach(() => {
      snapKeyring.createAccount(mockSnapId, mockAddress);
    });
    it('signs legacy transaction', async () => {
      const mockSignedTx = {
        data: '0x1a8451e600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        gasLimit: '0x26259fe',
        gasPrice: '0x1',
        nonce: '0xfffffffe',
        to: '0xccccccccccccd000000000000000000000000000',
        value: '0x1869e',
        r: '0x0',
        s: '0x0',
        v: '0x27',
      };
      const mockSignedEthereumJsTx =
        TransactionFactory.fromTxData(mockSignedTx);
      mockHandleRequest.mockResolvedValue(mockSignedEthereumJsTx);

      const txData = {
        data: '0x1a8451e600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        gasLimit: '0x26259fe',
        gasPrice: '0x1',
        nonce: '0xfffffffe',
        to: '0xccccccccccccd000000000000000000000000000',
        value: '0x1869e',
        chainId: '0x1',
        type: '0x00',
      };

      const transaction = TransactionFactory.fromTxData(txData);
      const serializedTransaction = serializeTx(transaction);

      const signedTransaction = await snapKeyring.signTransaction(
        mockAddress,
        transaction,
      );

      expect(mockHandleRequest).toHaveBeenCalledWith({
        snapId: mockSnapId,
        origin: 'metamask',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'keyring_approveRequest',
          params: {
            id: 'testId',
            method: 'eth_sendTransaction',
            params: [mockAddress, serializedTransaction],
          },
        },
      });
      expect(signedTransaction).toStrictEqual(mockSignedEthereumJsTx);
    });

    it('signs eip1559 transaction', async () => {
      const mockSignedTx = {
        data: '0x1a8451e600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        gasLimit: '0x26259fe',
        maxPriorityFeePerGas: '0x11',
        maxFeePerGas: '0x22',
        nonce: '0xfffffffe',
        to: '0xccccccccccccd000000000000000000000000000',
        value: '0x1869e',
        r: '0x0',
        s: '0x0',
        v: '0x1',
        type: 2,
      };
      const mockSignedEthereumJsTx =
        TransactionFactory.fromTxData(mockSignedTx);
      mockHandleRequest.mockResolvedValue(mockSignedEthereumJsTx);

      const txData = {
        data: '0x1a8451e600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        gasLimit: '0x26259fe',
        maxPriorityFeePerGas: '0x11',
        maxFeePerGas: '0x22',
        nonce: '0xfffffffe',
        to: '0xccccccccccccd000000000000000000000000000',
        value: '0x1869e',
        chainId: '0x1',
        type: 2,
      };

      const transaction = TransactionFactory.fromTxData(txData);
      const serializedTransaction = serializeTx(transaction);

      const signedTransaction = await snapKeyring.signTransaction(
        mockAddress,
        transaction,
      );

      expect(mockHandleRequest).toHaveBeenCalledWith({
        snapId: mockSnapId,
        origin: 'metamask',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'keyring_approveRequest',
          params: {
            id: 'testId',
            method: 'eth_sendTransaction',
            params: [mockAddress, serializedTransaction],
          },
        },
      });
      expect(signedTransaction).toStrictEqual(mockSignedEthereumJsTx);
      expect(signedTransaction.type).toBe(2);
    });
  });
  describe('sign typed message', () => {
    beforeEach(() => {
      snapKeyring.createAccount(mockSnapId, mockAddress);
    });
    it("signs typed message with 'eth_signTypedData_v1'", async () => {
      mockHandleRequest.mockResolvedValue(
        '0xab69130a4ea1b290158a599502c3786501d296f531aacac63a79fba7c0a6e16610d2baa29eb426e1c8971bd550cb640f92dff9323ef5a2ffe8df203d820669961c',
      );
      const typedData = [
        {
          type: 'string',
          name: 'message',
          value: 'Hi, Alice!',
        },
      ];

      const signature = await snapKeyring.signTypedData(
        mockAddress,
        typedData,
        {
          version: SignTypedDataVersion.V1,
        },
      );
      const restored = recoverTypedSignature({
        data: typedData,
        signature,
        version: SignTypedDataVersion.V1,
      });

      expect(mockHandleRequest).toHaveBeenCalledWith({
        snapId: mockSnapId,
        origin: 'metamask',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'keyring_approveRequest',
          params: {
            id: 'testId',
            method: 'eth_signTypedData',
            params: [
              mockAddress,
              typedData,
              { version: SignTypedDataVersion.V1 },
            ],
          },
        },
      });
      expect(restored).toStrictEqual(mockAddress);
    });
    it("signs typed message with 'eth_signTypedData_v3'", async () => {
      mockHandleRequest.mockResolvedValue(
        '0xf94f122435c5286256db99153ce6a3a0eb9c6796dc638f5764a2b433affeb9a67855fc984956f32a1700e483db6a09aad9fc572b56b769629827837ad5705fba1b',
      );
      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'address' },
          ],
          Mail: [
            { name: 'from', type: 'Person' },
            { name: 'to', type: 'Person' },
            { name: 'contents', type: 'string' },
          ],
        },
        primaryType: 'Mail' as const,
        domain: {
          name: 'Ether Mail',
          version: '1',
          chainId: 1,
          verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
        },
        message: {
          from: {
            name: 'Cow',
            wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
          },
          to: {
            name: 'Bob',
            wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
          },
          contents: 'Hello, Bob!',
        },
      };

      const signature = await snapKeyring.signTypedData(
        mockAddress,
        typedData,
        {
          version: SignTypedDataVersion.V3,
        },
      );
      const restored = recoverTypedSignature({
        data: typedData,
        signature,
        version: SignTypedDataVersion.V3,
      });

      expect(mockHandleRequest).toHaveBeenCalledWith({
        snapId: mockSnapId,
        origin: 'metamask',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'keyring_approveRequest',
          params: {
            id: 'testId',
            method: 'eth_signTypedData',
            params: [
              mockAddress,
              typedData,
              { version: SignTypedDataVersion.V3 },
            ],
          },
        },
      });
      expect(restored).toStrictEqual(mockAddress);
    });

    it("signs typed message with 'eth_signTypedData_v4'", async () => {
      mockHandleRequest.mockResolvedValue(
        '0x220917664ef676d592bd709a5bffedaf69c5f6c72f13c6c4547a41d211f0923c3180893b1dec023433f11b664fabda22b74b57d21094f7798fc85b7650f8edbb1b',
      );
      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallets', type: 'address[]' },
          ],
          Mail: [
            { name: 'from', type: 'Person' },
            { name: 'to', type: 'Person[]' },
            { name: 'contents', type: 'string' },
          ],
          Group: [
            { name: 'name', type: 'string' },
            { name: 'members', type: 'Person[]' },
          ],
        },
        domain: {
          name: 'Ether Mail',
          version: '1',
          chainId: 1,
          verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
        },
        primaryType: 'Mail' as const,
        message: {
          from: {
            name: 'Cow',
            wallets: [
              '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
              '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
            ],
          },
          to: [
            {
              name: 'Bob',
              wallets: [
                '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
                '0xB0BdaBea57B0BDABeA57b0bdABEA57b0BDabEa57',
                '0xB0B0b0b0b0b0B000000000000000000000000000',
              ],
            },
          ],
          contents: 'Hello, Bob!',
        },
      };

      const signature = await snapKeyring.signTypedData(
        mockAddress,
        typedData,
        {
          version: SignTypedDataVersion.V4,
        },
      );
      const restored = recoverTypedSignature({
        data: typedData,
        signature,
        version: SignTypedDataVersion.V4,
      });

      expect(mockHandleRequest).toHaveBeenCalledWith({
        snapId: mockSnapId,
        origin: 'metamask',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'keyring_approveRequest',
          params: {
            id: 'testId',
            method: 'eth_signTypedData',
            params: [
              mockAddress,
              typedData,
              { version: SignTypedDataVersion.V4 },
            ],
          },
        },
      });
      expect(restored).toStrictEqual(mockAddress);
    });
  });

  describe('sign personal message', () => {
    beforeEach(() => {
      snapKeyring.createAccount(mockSnapId, mockAddress);
    });

    it('signs personal message', async () => {
      const message = '0x68656c6c6f20776f726c64';
      // private key of account 1
      const privateKey = Buffer.from(
        '8e82d2d74c50e5c8460f771d38a560ebe1151a9134c65a7e92b28ad0cfae7151',
        'hex',
      );
      const expectedSig = personalSign({ privateKey, data: message });

      mockHandleRequest.mockResolvedValue(expectedSig);

      const signature = await snapKeyring.signPersonalMessage(
        mockAddress,
        message,
      );
      expect(mockHandleRequest).toHaveBeenCalledWith({
        snapId: mockSnapId,
        origin: 'metamask',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'keyring_approveRequest',
          params: {
            id: 'testId',
            method: 'personal_sign',
            params: [mockAddress, message],
          },
        },
      });
      expect(signature).toStrictEqual(expectedSig);
    });
  });
});

/**
 *
 * @param transaction
 */
function serializeTx(transaction: TypedTransaction): Record<string, any> {
  const serializedTransaction = {
    ...transaction.toJSON(),
    chainId: transaction.common.chainIdBN().toNumber(),
    type: transaction.type,
  };
  delete serializedTransaction.r;
  delete serializedTransaction.s;
  delete serializedTransaction.v;
  return serializedTransaction;
}
