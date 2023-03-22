import { SnapKeyring } from '.';
import { SnapKeyringErrors } from './errors';

describe('SnapKeyring', () => {
  let snapKeyring: SnapKeyring;
  const mockSnapController = jest.fn();

  const mockCAIP10Account =
    'eip155:1:0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb';
  const mockCAIP10Account2 =
    'eip155:2:0xfa814753a741d3a4998de68b693b61ffb65593486f50673b75ced1dc555eebeb';
  const mockSnapId = 'mockSnapId';
  const mockSnapId2 = 'mockSnapId2';

  beforeEach(() => {
    snapKeyring = new SnapKeyring();
    snapKeyring.setController(mockSnapController);
  });

  // it('signs a transaction', async () => {
  //   const mockSignature =
  //     '0x01afb6e247b1c490e284053c87ab5f6b59e219d51f743f7a4d83e400782bc7e4b9479a268e0e0acd4de3f1e28e4fac2a6b32a4195e8dfa9d19147abe8807aa6f64';
  //   mockSnapController.mockResolvedValue(mockSignature);
  //   jest.mock('./util.ts', () => ({
  //     deferredPromise: () =>
  //       jest.fn().mockImplementation(() => {
  //         return {
  //           promise: jest.fn().mockResolvedValue(mockSignature),
  //         };
  //       }),
  //   }));

  //   snapKeyring.createAccount(mockSnapId, mockCAIP10Account);

  //   const txData = {
  //     data: '0x1a8451e600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  //     gasLimit: '0x02625a00',
  //     maxPriorityFeePerGas: '0x01',
  //     maxFeePerGas: '0xff',
  //     nonce: '0x00',
  //     to: '0xcccccccccccccccccccccccccccccccccccccccc',
  //     value: '0x0186a0',
  //     v: null,
  //     r: null,
  //     s: null,
  //     chainId: '0x01',
  //     accessList: [],
  //     type: '0x02',
  //   };

  //   const signedTransaction = await snapKeyring.signTransaction(
  //     mockCAIP10Account,
  //     txData,
  //   );

  //   expect(signedTransaction).toBe('');
  // });

  it('setController returns', () => {
    const localSnapKeyring = new SnapKeyring();
    expect(() =>
      localSnapKeyring.setController(mockSnapController),
    ).not.toThrow();
  });

  // it.skip('sendsRequestToSnap', async () => {
  //   const expectedResult = {};
  //   await expect(
  //     snapKeyring.sendRequestToSnap(mockSnapId, {}),
  //   ).resolves.toStrictEqual({});
  //   expect(mockSnapController).toHaveBeenCalledTimes(1);
  //   expect(mockSnapController).toHaveBeenCalledWith({});
  // });

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
      mockSnapController.mockResolvedValue(true);
      const removalResult = snapKeyring.removeAccount(mockCAIP10Account);

      expect(removalResult).toBe(true);
      expect(mockSnapController).toBeCalledTimes(1);
      expect(mockSnapController).toHaveBeenCalledWith({});
    });

    it("throws error when trying to remove an account that doesn't exist", async () => {
      await expect(
        snapKeyring.removeAccount(mockCAIP10Account),
      ).rejects.toThrow(SnapKeyringErrors.UnknownAccount);
      expect(mockSnapController).toBeCalledTimes(0);
    });

    it('throws error if snap rejected the call', async () => {
      mockSnapController.mockRejectedValue('snapError');
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
      'eip155:1:0x9862D074e33003726fA05c74F0142995f33A3250';
    const mockCAIP10Account4 =
      'eip155:1:0x650Ab9303424bb854Ff86B1325067e23167264Ac';
    const mockCAIP10Account5 =
      'eip155:1:0xa76765C44767da8107f6A33e44A1D828F1438919';
    beforeEach(() => {
      snapKeyring.createAccount(mockSnapId, mockCAIP10Account);
      snapKeyring.createAccount(mockSnapId, mockCAIP10Account2);

      snapKeyring.createAccount(mockSnapId2, mockCAIP10Account3);
      snapKeyring.createAccount(mockSnapId2, mockCAIP10Account4);
      snapKeyring.createAccount(mockSnapId2, mockCAIP10Account5);
    });

    it('deletes all the accounts by snapId', async () => {
      expect(() =>
        snapKeyring.deleteAccountsByOrigin(mockSnapId),
      ).not.toThrow();

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
      expect(() =>
        snapKeyring.deleteAccountsByOrigin('unknown snap id'),
      ).toThrow(SnapKeyringErrors.UnknownSnapId);

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
});
