import { TransactionFactory } from '@ethereumjs/tx';
import { EthAccountType, EthMethod } from '@metamask/keyring-api';
import { SnapController } from '@metamask/snaps-controllers';

import { KeyringState, SnapKeyring } from '.';

describe('SnapKeyring', () => {
  let keyring: SnapKeyring;

  const mockSnapController = {
    handleRequest: jest.fn(),
    get: jest.fn(),
  };

  const mockCallbacks = {
    saveState: jest.fn(),
  };

  const snapId = 'local:snap.mock';

  const accounts = [
    {
      id: 'b05d918a-b37c-497a-bb28-3d15c0d56b7a',
      address: '0xC728514Df8A7F9271f4B7a4dd2Aa6d2D723d3eE3'.toLowerCase(),
      options: {},
      methods: [EthMethod.PersonalSign, EthMethod.SignTransaction],
      type: EthAccountType.Eoa,
    },
    {
      id: '33c96b60-2237-488e-a7bb-233576f3d22f',
      address: '0x34b13912eAc00152bE0Cb409A301Ab8E55739e63'.toLowerCase(),
      options: {},
      methods: [EthMethod.SignTransaction, EthMethod.SignTypedData],
      type: EthAccountType.Eoa,
    },
  ] as const;

  beforeEach(async () => {
    keyring = new SnapKeyring(
      mockSnapController as unknown as SnapController,
      mockCallbacks,
    );
    for (const account of accounts) {
      mockSnapController.handleRequest.mockResolvedValue(accounts);
      await keyring.handleKeyringSnapMessage(snapId, {
        method: 'createAccount',
        // @ts-expect-error Check https://github.com/ianstormtaylor/superstruct/issues/983
        params: { account: account as unknown as InternalAccount },
      });
    }
  });

  describe('handleKeyringSnapMessage', () => {
    it('should return the list of accounts', async () => {
      const result = await keyring.handleKeyringSnapMessage(snapId, {
        method: 'listAccounts',
      });
      expect(result).toStrictEqual(accounts);
    });

    it('should fail if the method is not supported', async () => {
      await expect(
        keyring.handleKeyringSnapMessage(snapId, {
          method: 'invalid',
        }),
      ).rejects.toThrow('Method not supported: invalid');
    });

    it('should submit an async request and return the result', async () => {
      mockSnapController.handleRequest.mockResolvedValue({
        pending: true,
        redirect: null,
      });
      const requestPromise = keyring.signPersonalMessage(
        accounts[0].address,
        'hello',
      );

      const { calls } = mockSnapController.handleRequest.mock;
      const requestId = calls[calls.length - 1][0].request.params.id;
      await keyring.handleKeyringSnapMessage(snapId, {
        method: 'submitResponse',
        params: {
          id: requestId,
          result: '0x123',
        },
      });
      expect(await requestPromise).toBe('0x123');
    });
  });

  describe('getAccounts', () => {
    it('should return all account addresses', async () => {
      const addresses = await keyring.getAccounts();
      expect(addresses).toStrictEqual(
        accounts.map((a) => a.address.toLowerCase()),
      );
      expect(mockSnapController.handleRequest).toHaveBeenCalledWith({
        handler: 'onRpcRequest',
        origin: 'metamask',
        request: {
          id: expect.any(String),
          jsonrpc: '2.0',
          method: 'keyring_listAccounts',
        },
        snapId,
      });
    });
  });

  describe('serialize', () => {
    it('should return the keyring state', async () => {
      const expectedState = {
        addressToAccount: {
          [accounts[0].address.toLowerCase()]: accounts[0],
          [accounts[1].address.toLowerCase()]: accounts[1],
        },
        addressToSnapId: {
          [accounts[0].address.toLowerCase()]: snapId,
          [accounts[1].address.toLowerCase()]: snapId,
        },
      };
      const state = await keyring.serialize();
      expect(state).toStrictEqual(expectedState);
    });
  });

  describe('deserialize', () => {
    it('should restore the keyring state', async () => {
      // State only contains the first account
      const state = {
        addressToAccount: {
          [accounts[0].address]: accounts[0],
        },
        addressToSnapId: {
          [accounts[0].address]: snapId,
        },
      };
      const expectedAddresses = [accounts[0].address];
      await keyring.deserialize(state as unknown as KeyringState);
      const addresses = await keyring.getAccounts();
      expect(addresses).toStrictEqual(expectedAddresses);
    });

    it('should fail to restore an undefined state', async () => {
      // Reset the keyring so it's empty.
      keyring = new SnapKeyring(
        mockSnapController as unknown as SnapController,
        mockCallbacks,
      );
      await keyring.deserialize(undefined as unknown as KeyringState);
      expect(await keyring.getAccounts()).toStrictEqual([]);
    });

    it('should fail to restore an empty state', async () => {
      // Reset the keyring so it's empty.
      keyring = new SnapKeyring(
        mockSnapController as unknown as SnapController,
        mockCallbacks,
      );
      await expect(
        keyring.deserialize({} as unknown as KeyringState),
      ).rejects.toThrow('Expected an object, but received: undefined');
      expect(await keyring.getAccounts()).toStrictEqual([]);
    });
  });

  describe('signTransaction', () => {
    it('should sign a ethereum transaction synchronously', async () => {
      const mockTx = {
        data: '0x0',
        gasLimit: '0x26259fe',
        gasPrice: '0x1',
        nonce: '0xfffffffe',
        to: '0xccccccccccccd000000000000000000000000000',
        value: '0x1869e',
        chainId: '0x1',
        type: '0x00',
      };
      const mockSignedTx = {
        ...mockTx,
        r: '0x0',
        s: '0x0',
        v: '0x27',
      };
      const tx = TransactionFactory.fromTxData(mockTx);
      const expectedSignedTx = TransactionFactory.fromTxData(mockSignedTx);
      mockSnapController.handleRequest.mockResolvedValue({
        pending: false,
        result: mockSignedTx,
      });
      const signature = await keyring.signTransaction(accounts[0].address, tx);
      expect(signature).toStrictEqual(expectedSignedTx);
    });
  });

  describe('signTypedData', () => {
    it('should sign a typed data', async () => {
      const data = {
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
        primaryType: 'Mail',
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
      const expectedSignature =
        '0x4355c47d63924e8a72e509b65029052eb6c299d53a04e167c5775fd466751c9d07299936d304c153f6443dfa05f40ff007d72911b6f72307f996231605b915621c';

      mockSnapController.handleRequest.mockResolvedValue({
        pending: false,
        result: expectedSignature,
      });

      const signature = await keyring.signTypedData(accounts[0].address, data);
      expect(mockSnapController.handleRequest).toHaveBeenCalledWith({
        snapId,
        handler: 'onRpcRequest',
        origin: 'metamask',
        request: {
          id: expect.any(String),
          jsonrpc: '2.0',
          method: 'keyring_submitRequest',
          params: {
            id: expect.any(String),
            scope: expect.any(String),
            account: accounts[0].id,
            request: {
              method: 'eth_signTypedData',
              params: [accounts[0].address, data],
            },
          },
        },
      });
      expect(signature).toStrictEqual(expectedSignature);
    });
  });

  describe('signPersonalMessage', () => {
    it('should sign a personal message', async () => {
      const mockMessage = 'Hello World!';
      const expectedSignature = '0x0';
      mockSnapController.handleRequest.mockResolvedValue({
        pending: false,
        result: expectedSignature,
      });
      const signature = await keyring.signPersonalMessage(
        accounts[0].address,
        mockMessage,
      );
      expect(signature).toStrictEqual(expectedSignature);
    });

    it('should fail if the address is not found', async () => {
      const mockMessage = 'Hello World!';
      await expect(
        keyring.signPersonalMessage('0x0', mockMessage),
      ).rejects.toThrow('Account address not found: 0x0');
    });

    it("should fail to resolve a request that wasn't submitted correctly", async () => {
      mockSnapController.handleRequest.mockRejectedValue(new Error('error'));
      const mockMessage = 'Hello World!';
      await expect(
        keyring.signPersonalMessage(accounts[0].address, mockMessage),
      ).rejects.toThrow('error');

      const { calls } = mockSnapController.handleRequest.mock;
      const requestId = calls[calls.length - 1][0].request.params.id;
      const responsePromise = keyring.handleKeyringSnapMessage(snapId, {
        method: 'submitResponse',
        params: {
          id: requestId,
          result: '0x123',
        },
      });
      await expect(responsePromise).rejects.toThrow(
        `No pending request found for ID: ${requestId as string}`,
      );
    });
  });

  describe('signMessage', () => {
    it('should sign a message', async () => {
      const mockMessage =
        '0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8';
      const expectedSignature = '0x0';
      mockSnapController.handleRequest.mockResolvedValue({
        pending: false,
        result: expectedSignature,
      });
      const signature = await keyring.signMessage(
        accounts[0].address,
        mockMessage,
      );
      expect(signature).toStrictEqual(expectedSignature);
      expect(mockSnapController.handleRequest).toHaveBeenCalledWith({
        handler: 'onRpcRequest',
        origin: 'metamask',
        request: {
          id: expect.any(String),
          jsonrpc: '2.0',
          method: 'keyring_submitRequest',
          params: {
            id: expect.any(String),
            scope: expect.any(String),
            account: accounts[0].id,
            request: {
              method: 'eth_sign',
              params: [accounts[0].address, mockMessage],
            },
          },
        },
        snapId: 'local:snap.mock',
      });
    });
  });

  describe('exportAccount', () => {
    it('should fail to export an account', async () => {
      expect(() => keyring.exportAccount(accounts[0].address)).toThrow(
        'Exporting accounts from snaps is not supported',
      );
    });
  });

  describe('removeAccount', () => {
    it('should throw an error if the account is not found', async () => {
      await expect(keyring.removeAccount('0x0')).rejects.toThrow(
        'Account address not found: 0x0',
      );
    });

    it('should remove an account', async () => {
      mockSnapController.handleRequest.mockResolvedValue(null);
      await keyring.removeAccount(accounts[0].address);
      expect(await keyring.getAccounts()).toStrictEqual([
        accounts[1].address.toLowerCase(),
      ]);
    });

    it('should remove the account and warn if snap fails', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      mockSnapController.handleRequest.mockRejectedValue('error');
      await keyring.removeAccount(accounts[0].address);
      expect(await keyring.getAccounts()).toStrictEqual([
        accounts[1].address.toLowerCase(),
      ]);
      expect(console.error).toHaveBeenCalledWith(
        'Account "0xc728514df8a7f9271f4b7a4dd2aa6d2d723d3ee3" may not have been removed from snap "local:snap.mock":',
        'error',
      );
      spy.mockRestore();
    });
  });

  describe('listAccounts', () => {
    it('should return the list of accounts', async () => {
      const result = await keyring.listAccounts(true);
      const expected = accounts.map((a) => ({
        ...a,
        metadata: {
          name: '',
          snap: undefined,
          keyring: {
            type: 'Snap Keyring',
          },
        },
      }));
      expect(result).toStrictEqual(expected);
    });
  });
});
