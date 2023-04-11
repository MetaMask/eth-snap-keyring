import { TransactionFactory, TypedTransaction } from '@ethereumjs/tx';
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

  const mockAddress = '0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb';
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

    it("signs typed message with 'eth_signTypedData_v4'", async () => {});

    it("signs typed message with 'eth_signTypedData_v3'", async () => {});

    it("signs typed message with 'eth_signTypedData_v1'", async () => {});
  });
});

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
