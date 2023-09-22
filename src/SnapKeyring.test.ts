import { TransactionFactory } from '@ethereumjs/tx';
import { SignTypedDataVersion } from '@metamask/eth-sig-util';
import type { KeyringAccount } from '@metamask/keyring-api';
import { EthAccountType, EthMethod } from '@metamask/keyring-api';
import { KeyringEvent } from '@metamask/keyring-api/dist/events';
import type { SnapController } from '@metamask/snaps-controllers';

import type { KeyringState } from '.';
import { SnapKeyring } from '.';

describe('SnapKeyring', () => {
  let keyring: SnapKeyring;

  const mockSnapController = {
    handleRequest: jest.fn(),
    get: jest.fn(),
  };

  const mockCallbacks = {
    saveState: jest.fn(),
    removeAccount: jest.fn(),
    addressExists: jest.fn(),
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
      methods: [EthMethod.SignTransaction, EthMethod.SignTypedDataV1],
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
        method: KeyringEvent.AccountCreated,
        params: { account: account as unknown as KeyringAccount },
      });
    }
  });

  describe('handleKeyringSnapMessage', () => {
    it('throws if we try to add an account that already exists', async () => {
      mockCallbacks.addressExists.mockResolvedValue(true);
      await expect(
        keyring.handleKeyringSnapMessage(snapId, {
          method: KeyringEvent.AccountCreated,
          params: { account: accounts[0] as unknown as KeyringAccount },
        }),
      ).rejects.toThrow(`Account '${accounts[0].address}' already exists`);
    });

    it('updated the methods of an account', async () => {
      // Return the updated list of accounts when the keyring requests it.
      mockSnapController.handleRequest.mockResolvedValue([
        { ...accounts[0], methods: [] },
        { ...accounts[1] },
      ]);

      expect(
        await keyring.handleKeyringSnapMessage(snapId, {
          method: KeyringEvent.AccountUpdated,
          params: { account: { ...accounts[0], methods: [] } },
        }),
      ).toBeNull();

      const keyringAccounts = await keyring.listAccounts();
      expect(keyringAccounts.length).toBeGreaterThan(0);
      expect(keyringAccounts[0]?.methods).toStrictEqual([]);
    });

    it("cannot updated an account that doesn't exist", async () => {
      await expect(
        keyring.handleKeyringSnapMessage(snapId, {
          method: KeyringEvent.AccountUpdated,
          params: { account: { id: 'some-invalid-id' } },
        }),
      ).rejects.toThrow("Account 'some-invalid-id' not found");
    });

    it('cannot change the address of an account', async () => {
      await expect(
        keyring.handleKeyringSnapMessage(snapId, {
          method: KeyringEvent.AccountUpdated,
          params: {
            account: { id: accounts[0].id, address: accounts[1].address },
          },
        }),
      ).rejects.toThrow(
        "Cannot change address of account 'b05d918a-b37c-497a-bb28-3d15c0d56b7a'",
      );
    });

    it('cannot updated an account owned by another snap', async () => {
      await expect(
        keyring.handleKeyringSnapMessage('invalid-snap-id', {
          method: KeyringEvent.AccountUpdated,
          params: {
            account: { id: accounts[0].id, address: accounts[0].address },
          },
        }),
      ).rejects.toThrow(
        "Cannot update account 'b05d918a-b37c-497a-bb28-3d15c0d56b7a'",
      );
    });

    it('removes an account', async () => {
      mockCallbacks.removeAccount.mockImplementation(async (address) => {
        await keyring.removeAccount(address);
      });

      await keyring.handleKeyringSnapMessage(snapId, {
        method: KeyringEvent.AccountDeleted,
        params: { id: accounts[0].id },
      });
      expect(await keyring.getAccounts()).toStrictEqual([
        accounts[1].address.toLowerCase(),
      ]);
    });

    it('returns null when removing an account that does not exist', async () => {
      mockCallbacks.removeAccount.mockImplementation(async (address) => {
        await keyring.removeAccount(address);
      });

      expect(
        await keyring.handleKeyringSnapMessage(snapId, {
          method: KeyringEvent.AccountDeleted,
          params: { id: 'bcda5b5f-098f-4706-919b-ee919402f0dd' },
        }),
      ).toBeNull();
    });

    it('fails when the method is not supported', async () => {
      await expect(
        keyring.handleKeyringSnapMessage(snapId, {
          method: 'invalid',
        }),
      ).rejects.toThrow('Method not supported: invalid');
    });

    it('approves an async request', async () => {
      mockSnapController.handleRequest.mockResolvedValue({
        pending: true,
      });
      const requestPromise = keyring.signPersonalMessage(
        accounts[0].address,
        'hello',
      );

      const { calls } = mockSnapController.handleRequest.mock;
      const requestId = calls[calls.length - 1][0].request.params.id;
      await keyring.handleKeyringSnapMessage(snapId, {
        method: KeyringEvent.RequestApproved,
        params: {
          id: requestId,
          result: '0x123',
        },
      });
      expect(await requestPromise).toBe('0x123');
    });

    it.each([
      [
        { message: 'Go to dapp to continue.' },
        'The snap requested a redirect: message="Go to dapp to continue.", url=""',
      ],
      [
        { url: 'https://example.com/sign?tx=1234' },
        'The snap requested a redirect: message="", url="https://example.com/sign?tx=1234"',
      ],
    ])('returns a redirect %s', async (redirect, message) => {
      const spy = jest.spyOn(console, 'log').mockImplementation();

      mockSnapController.handleRequest.mockResolvedValue({
        pending: true,
        redirect,
      });
      const requestPromise = keyring.signPersonalMessage(
        accounts[0].address,
        'hello',
      );

      const { calls } = mockSnapController.handleRequest.mock;
      const requestId = calls[calls.length - 1][0].request.params.id;
      await keyring.handleKeyringSnapMessage(snapId, {
        method: KeyringEvent.RequestRejected,
        params: { id: requestId },
      });

      // We need to await on the request promise because the request submission
      // is async, so if we don't await, the test will exit before the promise
      // gets resolved.
      await expect(requestPromise).rejects.toThrow(
        'Request rejected by user or snap.',
      );

      expect(console.log).toHaveBeenCalledWith(message);
      spy.mockRestore();
    });

    it('rejects an async request', async () => {
      mockSnapController.handleRequest.mockResolvedValue({
        pending: true,
      });
      const requestPromise = keyring.signPersonalMessage(
        accounts[0].address,
        'hello',
      );

      const { calls } = mockSnapController.handleRequest.mock;
      const requestId = calls[calls.length - 1][0].request.params.id;
      await keyring.handleKeyringSnapMessage(snapId, {
        method: KeyringEvent.RequestRejected,
        params: { id: requestId },
      });
      await expect(requestPromise).rejects.toThrow(
        'Request rejected by user or snap.',
      );
    });
  });

  describe('getAccounts', () => {
    it('returns all account addresses', async () => {
      const addresses = await keyring.getAccounts();
      expect(addresses).toStrictEqual(
        accounts.map((a) => a.address.toLowerCase()),
      );
    });
  });

  describe('serialize', () => {
    it('returns the keyring state', async () => {
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
    it('restores the keyring state', async () => {
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

    it('fails to restore an undefined state', async () => {
      // Reset the keyring so it's empty.
      keyring = new SnapKeyring(
        mockSnapController as unknown as SnapController,
        mockCallbacks,
      );
      await keyring.deserialize(undefined as unknown as KeyringState);
      expect(await keyring.getAccounts()).toStrictEqual([]);
    });

    it('fails to restore an empty state', async () => {
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
    it('signs a ethereum transaction synchronously', async () => {
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
    const dataToSign = {
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

    it('signs typed data without options', async () => {
      mockSnapController.handleRequest.mockResolvedValue({
        pending: false,
        result: expectedSignature,
      });

      const signature = await keyring.signTypedData(
        accounts[0].address,
        dataToSign,
      );
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
              method: 'eth_signTypedData_v1',
              params: [accounts[0].address, dataToSign],
            },
          },
        },
      });
      expect(signature).toStrictEqual(expectedSignature);
    });

    it('signs typed data options (v4)', async () => {
      mockSnapController.handleRequest.mockResolvedValue({
        pending: false,
        result: expectedSignature,
      });

      const signature = await keyring.signTypedData(
        accounts[0].address,
        dataToSign,
        { version: SignTypedDataVersion.V4 },
      );
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
              method: 'eth_signTypedData_v4',
              params: [accounts[0].address, dataToSign],
            },
          },
        },
      });
      expect(signature).toStrictEqual(expectedSignature);
    });

    it('signs typed data invalid options (v2)', async () => {
      mockSnapController.handleRequest.mockResolvedValue({
        pending: false,
        result: expectedSignature,
      });

      const signature = await keyring.signTypedData(
        accounts[0].address,
        dataToSign,
        { version: 'V2' as any },
      );
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
              method: 'eth_signTypedData_v1',
              params: [accounts[0].address, dataToSign],
            },
          },
        },
      });
      expect(signature).toStrictEqual(expectedSignature);
    });
  });

  describe('signPersonalMessage', () => {
    it('signs a personal message', async () => {
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

    it('fails if the address is not found', async () => {
      const mockMessage = 'Hello World!';
      await expect(
        keyring.signPersonalMessage('0x0', mockMessage),
      ).rejects.toThrow("Account '0x0' not found");
    });

    it("fails to resolve a request that wasn't submitted correctly", async () => {
      mockSnapController.handleRequest.mockRejectedValue(new Error('error'));
      const mockMessage = 'Hello World!';
      await expect(
        keyring.signPersonalMessage(accounts[0].address, mockMessage),
      ).rejects.toThrow('error');

      const { calls } = mockSnapController.handleRequest.mock;
      const requestId = calls[calls.length - 1][0].request.params.id;
      const responsePromise = keyring.handleKeyringSnapMessage(snapId, {
        method: KeyringEvent.RequestApproved,
        params: {
          id: requestId,
          result: '0x123',
        },
      });
      await expect(responsePromise).rejects.toThrow(
        `Pending request '${requestId as string}' not found`,
      );
    });
  });

  describe('signMessage', () => {
    it('signs a message', async () => {
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
    it('fails to export an account', async () => {
      expect(() => keyring.exportAccount(accounts[0].address)).toThrow(
        'Exporting accounts from snaps is not supported',
      );
    });
  });

  describe('removeAccount', () => {
    it('throws an error if the account is not found', async () => {
      await expect(keyring.removeAccount('0x0')).rejects.toThrow(
        "Account '0x0' not found",
      );
    });

    it('removes an account', async () => {
      mockSnapController.handleRequest.mockResolvedValue(null);
      await keyring.removeAccount(accounts[0].address);
      expect(await keyring.getAccounts()).toStrictEqual([
        accounts[1].address.toLowerCase(),
      ]);
    });

    it('removes the account and warn if snap fails', async () => {
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
    it('returns the list of accounts', async () => {
      const snapMetadata = {
        id: snapId,
        name: 'Snap Name',
        enabled: true,
      };
      const snapObject = {
        id: snapId,
        manifest: {
          proposedName: 'Snap Name',
        },
        enabled: true,
      };
      mockSnapController.get.mockReturnValue(snapObject);
      const result = await keyring.listAccounts();
      const expected = accounts.map((a) => ({
        ...a,
        metadata: {
          name: '',
          snap: snapMetadata,
          keyring: {
            type: 'Snap Keyring',
          },
        },
      }));
      expect(result).toStrictEqual(expected);
    });
  });
});
