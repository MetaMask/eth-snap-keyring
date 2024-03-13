import { TransactionFactory } from '@ethereumjs/tx';
import { SignTypedDataVersion } from '@metamask/eth-sig-util';
import type {
  EthBaseUserOperation,
  EthUserOperation,
  EthUserOperationPatch,
  KeyringAccount,
  KeyringExecutionContext,
} from '@metamask/keyring-api';
import { EthAccountType, EthMethod } from '@metamask/keyring-api';
import { KeyringEvent } from '@metamask/keyring-api/dist/events';
import type { SnapController } from '@metamask/snaps-controllers';
import type { SnapId } from '@metamask/snaps-sdk';

import type { KeyringState } from '.';
import { SnapKeyring } from '.';
import { CaipNamespaces, toCaipChainId } from './caip';

const regexForUUIDInRequiredSyncErrorMessage =
  /Request '[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}' to snap 'local:snap.mock' is pending and expectSync is true/u;

describe('SnapKeyring', () => {
  let keyring: SnapKeyring;

  const mockSnapController = {
    handleRequest: jest.fn(),
    get: jest.fn(),
  };

  const mockCallbacks = {
    saveState: jest.fn(),
    addressExists: jest.fn(),
    addAccount: jest.fn(async (_address, _snapId, handleUserInput) => {
      await handleUserInput(true);
      return Promise.resolve();
    }),
    removeAccount: jest.fn(async (address, _snapId, handleUserInput) => {
      await keyring.removeAccount(address);
      await handleUserInput(true);
      return Promise.resolve();
    }),
    redirectUser: jest.fn(async () => Promise.resolve()),
  };

  const snapId = 'local:snap.mock' as SnapId;

  const accounts = [
    {
      id: 'b05d918a-b37c-497a-bb28-3d15c0d56b7a',
      address: '0xC728514Df8A7F9271f4B7a4dd2Aa6d2D723d3eE3'.toLowerCase(),
      options: {},
      methods: [...Object.values(EthMethod)],
      type: EthAccountType.Eoa,
    },
    {
      id: '33c96b60-2237-488e-a7bb-233576f3d22f',
      address: '0x34b13912eAc00152bE0Cb409A301Ab8E55739e63'.toLowerCase(),
      options: {},
      methods: [...Object.values(EthMethod)],
      type: EthAccountType.Eoa,
    },
  ] as const;

  const executionContext: KeyringExecutionContext = {
    chainId: '1',
  };

  beforeEach(async () => {
    keyring = new SnapKeyring(
      mockSnapController as unknown as SnapController,
      mockCallbacks,
    );
    mockCallbacks.addAccount.mockImplementation(
      async (_address, _snapId, handleUserInput) => {
        await handleUserInput(true);
      },
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
    it('cannot add an account that already exists (address)', async () => {
      mockCallbacks.addressExists.mockResolvedValue(true);
      await expect(
        keyring.handleKeyringSnapMessage(snapId, {
          method: KeyringEvent.AccountCreated,
          params: {
            account: {
              ...(accounts[0] as unknown as KeyringAccount),
              id: 'c6697bcf-5710-4751-a1cb-340e4b50617a',
            },
          },
        }),
      ).rejects.toThrow(
        `Account address '${accounts[0].address}' already exists`,
      );
    });

    it('cannot add an account that already exists (ID)', async () => {
      mockCallbacks.addressExists.mockResolvedValue(false);
      await expect(
        keyring.handleKeyringSnapMessage(snapId, {
          method: KeyringEvent.AccountCreated,
          params: {
            account: {
              ...(accounts[0] as unknown as KeyringAccount),
              address: '0x0',
            },
          },
        }),
      ).rejects.toThrow(`Account '${accounts[0].id}' already exists`);
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

      const keyringAccounts = keyring.listAccounts();
      expect(keyringAccounts.length).toBeGreaterThan(0);
      expect(keyringAccounts[0]?.methods).toStrictEqual([]);
    });

    it("cannot updated an account that doesn't exist", async () => {
      await expect(
        keyring.handleKeyringSnapMessage(snapId, {
          method: KeyringEvent.AccountUpdated,
          params: {
            account: {
              ...(accounts[0] as unknown as KeyringAccount),
              id: '0b3551da-1685-4750-ad4c-01fc3a9e90b1',
            },
          },
        }),
      ).rejects.toThrow(
        "Account '0b3551da-1685-4750-ad4c-01fc3a9e90b1' not found",
      );
    });

    it('cannot updated an account owned by another Snap', async () => {
      await expect(
        keyring.handleKeyringSnapMessage('a-different-snap-id' as SnapId, {
          method: KeyringEvent.AccountCreated,
          params: {
            account: { ...(accounts[0] as unknown as KeyringAccount) },
          },
        }),
      ).rejects.toThrow(
        'Snap "a-different-snap-id" is not allowed to set "b05d918a-b37c-497a-bb28-3d15c0d56b7a"',
      );
    });

    it('cannot change the address of an account', async () => {
      await expect(
        keyring.handleKeyringSnapMessage(snapId, {
          method: KeyringEvent.AccountUpdated,
          params: {
            account: {
              ...(accounts[0] as unknown as KeyringAccount),
              address: accounts[1].address,
            },
          },
        }),
      ).rejects.toThrow(
        "Cannot change address of account 'b05d918a-b37c-497a-bb28-3d15c0d56b7a'",
      );
    });

    it('cannot updated an account owned by another snap', async () => {
      await expect(
        keyring.handleKeyringSnapMessage('invalid-snap-id' as SnapId, {
          method: KeyringEvent.AccountUpdated,
          params: {
            account: {
              ...(accounts[0] as unknown as KeyringAccount),
            },
          },
        }),
      ).rejects.toThrow(
        "Account 'b05d918a-b37c-497a-bb28-3d15c0d56b7a' not found",
      );
    });

    it('removes an account', async () => {
      mockSnapController.handleRequest.mockResolvedValue(null);
      mockCallbacks.removeAccount.mockImplementation(
        async (address, _snapId, handleUserInput) => {
          await keyring.removeAccount(address);
          await handleUserInput(true);
        },
      );

      await keyring.handleKeyringSnapMessage(snapId, {
        method: KeyringEvent.AccountDeleted,
        params: { id: accounts[0].id },
      });
      expect(await keyring.getAccounts()).toStrictEqual([
        accounts[1].address.toLowerCase(),
      ]);
    });

    it('cannot delete an account owned by another snap', async () => {
      await keyring.handleKeyringSnapMessage('invalid-snap-id' as SnapId, {
        method: KeyringEvent.AccountDeleted,
        params: { id: accounts[0].id },
      });
      expect(await keyring.getAccounts()).toStrictEqual([
        accounts[0].address.toLowerCase(),
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

    it('fails when the method is invalid', async () => {
      await expect(
        keyring.handleKeyringSnapMessage(snapId, {
          method: 'invalid',
        }),
      ).rejects.toThrow('Method not supported: invalid');
    });

    it('fails when the EthMethod is not supported', async () => {
      // Update first account to remove `EthMethod.PersonalSign`
      let updatedMethods = Object.values(EthMethod).filter(
        (method) => method !== EthMethod.PersonalSign,
      );
      expect(
        await keyring.handleKeyringSnapMessage(snapId, {
          method: KeyringEvent.AccountUpdated,
          params: {
            account: {
              ...accounts[0],
              methods: updatedMethods,
            },
          },
        }),
      ).toBeNull();
      expect(keyring.listAccounts()[0]?.methods).toStrictEqual(updatedMethods);
      await expect(
        keyring.signPersonalMessage(accounts[0].address, 'hello'),
      ).rejects.toThrow(
        `Method '${EthMethod.PersonalSign}' not supported for account ${accounts[0].address}`,
      );
      // Restore `EthMethod.PersonalSign` and remove `EthMethod.SignTransaction`
      updatedMethods = Object.values(EthMethod).filter(
        (method) => method !== EthMethod.SignTransaction,
      );
      expect(
        await keyring.handleKeyringSnapMessage(snapId, {
          method: KeyringEvent.AccountUpdated,
          params: {
            account: {
              ...accounts[0],
              methods: updatedMethods,
            },
          },
        }),
      ).toBeNull();
      expect(keyring.listAccounts()[0]?.methods).toStrictEqual(updatedMethods);
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
      const tx = TransactionFactory.fromTxData(mockTx);
      await expect(
        keyring.signTransaction(accounts[0].address, tx),
      ).rejects.toThrow(
        `Method '${EthMethod.SignTransaction}' not supported for account ${accounts[0].address}`,
      );
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
      [{ message: 'Go to dapp to continue.' }],
      [{ url: 'https://example.com/sign?tx=1234' }],
      [{ url: 'https://example.com/sign?tx=12345', message: 'Go to dapp.' }],
    ])('returns a redirect %s', async (redirect) => {
      const spy = jest.spyOn(console, 'log').mockImplementation();

      const snapObject = {
        id: snapId,
        manifest: {
          initialPermissions: {
            'endowment:keyring': {
              allowedOrigins: ['https://example.com'],
            },
          },
        },
        enabled: true,
      };
      mockSnapController.get.mockReturnValue(snapObject);

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

      const { url = '', message = '' } = redirect as {
        url?: string;
        message?: string;
      };

      // We need to await on the request promise because the request submission
      // is async, so if we don't await, the test will exit before the promise
      // gets resolved.
      await expect(requestPromise).rejects.toThrow(
        'Request rejected by user or snap.',
      );

      // Check that `redirectUser` was called with the correct parameters
      expect(mockCallbacks.redirectUser).toHaveBeenCalledWith(
        snapId,
        url,
        message,
      );
      spy.mockRestore();
    });

    describe('async request redirect url', () => {
      const isNotAllowedOrigin = async (
        allowedOrigins: string[],
        redirectUrl: string,
      ) => {
        const { origin } = new URL(redirectUrl);
        const snapObject = {
          id: snapId,
          manifest: {
            initialPermissions:
              allowedOrigins.length > 0
                ? { 'endowment:keyring': { allowedOrigins } }
                : {},
          },
          enabled: true,
        };
        mockSnapController.get.mockReturnValue(snapObject);
        mockSnapController.handleRequest.mockResolvedValue({
          pending: true,
          redirect: {
            message: 'Go to dapp to continue.',
            url: redirectUrl,
          },
        });
        const requestPromise = keyring.signPersonalMessage(
          accounts[0].address,
          'hello',
        );

        await expect(requestPromise).rejects.toThrow(
          `Redirect URL domain '${origin}' is not an allowed origin by snap '${snapId}'`,
        );
      };

      it('throws an error if async request redirect url is not an allowed origin', async () => {
        expect.hasAssertions();
        await isNotAllowedOrigin(
          ['https://allowed.com'],
          'https://notallowed.com/sign?tx=1234',
        );
      });

      it('throws an error if no allowed origins', async () => {
        expect.hasAssertions();
        await isNotAllowedOrigin([], 'https://example.com/sign?tx=1234');
      });

      it('throws an error if the snap is undefined', async () => {
        const redirect = {
          message: 'Go to dapp to continue.',
          url: 'https://example.com/sign?tx=1234',
        };

        mockSnapController.get.mockReturnValue(undefined);

        mockSnapController.handleRequest.mockResolvedValue({
          pending: true,
          redirect,
        });
        const requestPromise = keyring.signPersonalMessage(
          accounts[0].address,
          'hello',
        );

        await expect(requestPromise).rejects.toThrow(
          `Snap '${snapId}' not found.`,
        );
      });
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

    it("cannot approve another snap's request", async () => {
      mockSnapController.handleRequest.mockResolvedValue({
        pending: true,
      });
      // eslint-disable-next-line no-void
      void keyring.signPersonalMessage(accounts[0].address, 'hello');

      const { calls } = mockSnapController.handleRequest.mock;
      const requestId: string = calls[calls.length - 1][0].request.params.id;
      await expect(
        keyring.handleKeyringSnapMessage('another-snap-id' as SnapId, {
          method: KeyringEvent.RequestApproved,
          params: { id: requestId, result: '0x1234' },
        }),
      ).rejects.toThrow(`Request '${requestId}' not found`);
    });

    it("cannot reject another snap's request", async () => {
      mockSnapController.handleRequest.mockResolvedValue({
        pending: true,
      });
      // eslint-disable-next-line no-void
      void keyring.signPersonalMessage(accounts[0].address, 'hello');

      const { calls } = mockSnapController.handleRequest.mock;
      const requestId: string = calls[calls.length - 1][0].request.params.id;
      await expect(
        keyring.handleKeyringSnapMessage('another-snap-id' as SnapId, {
          method: KeyringEvent.RequestRejected,
          params: { id: requestId },
        }),
      ).rejects.toThrow(`Request '${requestId}' not found`);
    });

    it('fails to approve a request that failed when submitted', async () => {
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
        `Request '${requestId as string}' not found`,
      );
    });

    it("fails to approve a request that doesn't exist", async () => {
      const responsePromise = keyring.handleKeyringSnapMessage(snapId, {
        method: KeyringEvent.RequestApproved,
        params: {
          id: 'b59b5449-5517-4622-99f2-82670cc7f3f3',
          result: '0x123',
        },
      });
      await expect(responsePromise).rejects.toThrow(
        "Request 'b59b5449-5517-4622-99f2-82670cc7f3f3' not found",
      );
    });

    it("fails to reject a request that doesn't exist", async () => {
      const responsePromise = keyring.handleKeyringSnapMessage(snapId, {
        method: KeyringEvent.RequestRejected,
        params: {
          id: 'b59b5449-5517-4622-99f2-82670cc7f3f3',
        },
      });
      await expect(responsePromise).rejects.toThrow(
        "Request 'b59b5449-5517-4622-99f2-82670cc7f3f3' not found",
      );
    });

    it('throws an error if the removeAccount callback fails', async () => {
      mockCallbacks.removeAccount.mockImplementation(
        async (_address, _snapId, _handleUserInput) => {
          throw new Error('Some error occurred while removing account');
        },
      );

      await expect(
        keyring.handleKeyringSnapMessage(snapId, {
          method: KeyringEvent.AccountDeleted,
          params: { id: accounts[0].id },
        }),
      ).rejects.toThrow('Some error occurred while removing account');
    });

    it('returns null after successfully updating an account', async () => {
      const result = await keyring.handleKeyringSnapMessage(snapId, {
        method: KeyringEvent.AccountUpdated,
        params: { account: accounts[0] as unknown as KeyringAccount },
      });
      expect(mockCallbacks.saveState).toHaveBeenCalled();
      expect(result).toBeNull();
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
        accounts: {
          [accounts[0].id]: { account: accounts[0], snapId },
          [accounts[1].id]: { account: accounts[1], snapId },
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
        accounts: {
          [accounts[0].id]: { account: accounts[0], snapId },
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
      ).rejects.toThrow('Cannot convert undefined or null to object');
      expect(await keyring.getAccounts()).toStrictEqual([]);
    });
  });

  describe('signTransaction', () => {
    it('signs a ethereum transaction synchronously', async () => {
      const mockTx = {
        data: '0x00',
        gasLimit: '0x26259fe',
        gasPrice: '0x1',
        nonce: '0xfffffffe',
        to: '0xccccccccccccd000000000000000000000000000',
        value: '0x1869e',
        chainId: '0x1',
        type: '0x0',
      };
      const mockSignedTx = {
        ...mockTx,
        r: '0x0',
        s: '0x0',
        v: '0x27',
      };
      const tx = TransactionFactory.fromTxData(mockTx);
      const expectedSignedTx = TransactionFactory.fromTxData(mockSignedTx);
      const expectedScope = 'eip155:1';

      mockSnapController.handleRequest.mockResolvedValue({
        pending: false,
        result: mockSignedTx,
      });

      const signature = await keyring.signTransaction(accounts[0].address, tx);
      expect(mockSnapController.handleRequest).toHaveBeenCalledWith({
        snapId,
        handler: 'onKeyringRequest',
        origin: 'metamask',
        request: {
          id: expect.any(String),
          jsonrpc: '2.0',
          method: 'keyring_submitRequest',
          params: {
            id: expect.any(String),
            scope: expectedScope,
            account: accounts[0].id,
            request: {
              method: 'eth_signTransaction',
              params: [
                {
                  ...mockTx,
                  from: accounts[0].address,
                },
              ],
            },
          },
        },
      });
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

    const expectedScope = 'eip155:1';
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
        handler: 'onKeyringRequest',
        origin: 'metamask',
        request: {
          id: expect.any(String),
          jsonrpc: '2.0',
          method: 'keyring_submitRequest',
          params: {
            id: expect.any(String),
            scope: expectedScope,
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
        handler: 'onKeyringRequest',
        origin: 'metamask',
        request: {
          id: expect.any(String),
          jsonrpc: '2.0',
          method: 'keyring_submitRequest',
          params: {
            id: expect.any(String),
            scope: expectedScope,
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
        handler: 'onKeyringRequest',
        origin: 'metamask',
        request: {
          id: expect.any(String),
          jsonrpc: '2.0',
          method: 'keyring_submitRequest',
          params: {
            id: expect.any(String),
            scope: expectedScope,
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

    it('signs typed data without domain chainId has no scope', async () => {
      mockSnapController.handleRequest.mockResolvedValue({
        pending: false,
        result: expectedSignature,
      });

      const dataToSignWithoutDomainChainId = {
        ...dataToSign,
        domain: {
          name: dataToSign.domain.name,
          version: dataToSign.domain.version,
          verifyingContract: dataToSign.domain.verifyingContract,
          // We do not defined the chainId (it's currently marked as
          // optional in the current type declaration).
          // chainId: 1,
        },
      };

      const signature = await keyring.signTypedData(
        accounts[0].address,
        dataToSignWithoutDomainChainId,
        { version: SignTypedDataVersion.V4 },
      );
      expect(mockSnapController.handleRequest).toHaveBeenCalledWith({
        snapId,
        handler: 'onKeyringRequest',
        origin: 'metamask',
        request: {
          id: expect.any(String),
          jsonrpc: '2.0',
          method: 'keyring_submitRequest',
          params: {
            id: expect.any(String),
            // Without chainId alongside the typed message, we cannot
            // compute the scope for this request!
            scope: '', // Default value for `signTypedTransaction`
            account: accounts[0].id,
            request: {
              method: 'eth_signTypedData_v4',
              params: [accounts[0].address, dataToSignWithoutDomainChainId],
            },
          },
        },
      });
      expect(signature).toStrictEqual(expectedSignature);
    });

    it('calls eth_prepareUserOperation', async () => {
      const baseTxs = [
        {
          to: '0x0c54fccd2e384b4bb6f2e405bf5cbc15a017aafb',
          value: '0x0',
          data: '0x',
        },
        {
          to: '0x660265edc169bab511a40c0e049cc1e33774443d',
          value: '0x0',
          data: '0x619a309f',
        },
      ];

      const expectedBaseUserOp = {
        callData: '0x70641a22000000000000000000000000f3de3c0d654fda23da',
        initCode: '0x',
        nonce: '0x1',
        gasLimits: {
          callGasLimit: '0x58a83',
          verificationGasLimit: '0xe8c4',
          preVerificationGas: '0xc57c',
        },
        dummySignature: '0x',
        dummyPaymasterAndData: '0x',
        bundlerUrl: 'https://bundler.example.com/rpc',
      };

      mockSnapController.handleRequest.mockReturnValueOnce({
        pending: false,
        result: expectedBaseUserOp,
      });

      const baseUserOp = await keyring.prepareUserOperation(
        accounts[0].address,
        baseTxs,
        executionContext,
      );

      expect(mockSnapController.handleRequest).toHaveBeenCalledWith({
        snapId,
        handler: 'onKeyringRequest',
        origin: 'metamask',
        request: {
          id: expect.any(String),
          jsonrpc: '2.0',
          method: 'keyring_submitRequest',
          params: {
            id: expect.any(String),
            scope: toCaipChainId(CaipNamespaces.Eip155, executionContext.chainId),
            account: accounts[0].id,
            request: {
              method: 'eth_prepareUserOperation',
              params: baseTxs,
            },
          },
        },
      });

      expect(baseUserOp).toStrictEqual(expectedBaseUserOp);
    });

    it('calls eth_patchUserOperation', async () => {
      const userOp = {
        sender: accounts[0].address,
        nonce: '0x1',
        initCode: '0x',
        callData: '0x1234',
        callGasLimit: '0x58a83',
        verificationGasLimit: '0xe8c4',
        preVerificationGas: '0xc57c',
        maxFeePerGas: '0x87f0878c0',
        maxPriorityFeePerGas: '0x1dcd6500',
        paymasterAndData: '0x',
        signature: '0x',
      };

      const expectedPatch = {
        paymasterAndData: '0x1234',
      };

      mockSnapController.handleRequest.mockReturnValueOnce({
        pending: false,
        result: expectedPatch,
      });

      const patch = await keyring.patchUserOperation(
        accounts[0].address,
        userOp,
        executionContext,
      );

      expect(mockSnapController.handleRequest).toHaveBeenCalledWith({
        snapId,
        handler: 'onKeyringRequest',
        origin: 'metamask',
        request: {
          id: expect.any(String),
          jsonrpc: '2.0',
          method: 'keyring_submitRequest',
          params: {
            id: expect.any(String),
            scope: toCaipChainId(CaipNamespaces.Eip155, executionContext.chainId),
            account: accounts[0].id,
            request: {
              method: 'eth_patchUserOperation',
              params: [userOp],
            },
          },
        },
      });

      expect(patch).toStrictEqual(expectedPatch);
    });

    it('calls eth_signUserOperation', async () => {
      const userOp = {
        sender: accounts[0].address,
        nonce: '0x1',
        initCode: '0x',
        callData: '0x1234',
        callGasLimit: '0x58a83',
        verificationGasLimit: '0xe8c4',
        preVerificationGas: '0xc57c',
        maxFeePerGas: '0x87f0878c0',
        maxPriorityFeePerGas: '0x1dcd6500',
        paymasterAndData: '0x',
        signature: '0x',
      };

      mockSnapController.handleRequest.mockReturnValueOnce({
        pending: false,
        result: expectedSignature,
      });

      const signature = await keyring.signUserOperation(
        accounts[0].address,
        userOp,
        executionContext,
      );

      expect(mockSnapController.handleRequest).toHaveBeenCalledWith({
        snapId,
        handler: 'onKeyringRequest',
        origin: 'metamask',
        request: {
          id: expect.any(String),
          jsonrpc: '2.0',
          method: 'keyring_submitRequest',
          params: {
            id: expect.any(String),
            scope: toCaipChainId(CaipNamespaces.Eip155, executionContext.chainId),
            account: accounts[0].id,
            request: {
              method: 'eth_signUserOperation',
              params: [userOp],
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
        handler: 'onKeyringRequest',
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
      mockSnapController.handleRequest.mockRejectedValue('some error');
      await keyring.removeAccount(accounts[0].address);
      expect(await keyring.getAccounts()).toStrictEqual([
        accounts[1].address.toLowerCase(),
      ]);
      expect(console.error).toHaveBeenCalledWith(
        "Account '0xc728514df8a7f9271f4b7a4dd2aa6d2d723d3ee3' may not have been removed from snap 'local:snap.mock':",
        'some error',
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
      const result = keyring.listAccounts();
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

  describe('getAccountsBySnapId', () => {
    it('returns the list of addresses of a snap', async () => {
      const addresses = await keyring.getAccountsBySnapId(snapId);
      expect(addresses).toStrictEqual(
        accounts.map((a) => a.address.toLowerCase()),
      );
    });
  });

  describe('getAccountByAddress', () => {
    it('returns the account with that address', async () => {
      const snapMetadata = {
        manifest: {
          proposedName: 'snap-name',
        },
        id: snapId,
        enabled: true,
      };
      mockSnapController.get.mockReturnValue(snapMetadata);
      expect(keyring.getAccountByAddress(accounts[0].address)).toStrictEqual({
        ...accounts[0],
        metadata: {
          name: '',
          snap: { id: snapId, name: 'snap-name', enabled: true },
          keyring: { type: 'Snap Keyring' },
        },
      });
    });
  });

  describe('prepareUserOperation', () => {
    const mockIntents = [
      {
        to: '0x0c54fccd2e384b4bb6f2e405bf5cbc15a017aafb',
        value: '0x0',
        data: '0x',
      },
    ];

    const mockExpectedUserOp: EthBaseUserOperation = {
      callData: '0x70641a22000000000000000000000000f3de3c0d654fda23da',
      initCode: '0x',
      nonce: '0x1',
      gasLimits: {
        callGasLimit: '0x58a83',
        verificationGasLimit: '0xe8c4',
        preVerificationGas: '0xc57c',
      },
      dummySignature: '0x',
      dummyPaymasterAndData: '0x',
      bundlerUrl: 'https://bundler.example.com/rpc',
    };

    it('calls eth_prepareUserOperation', async () => {
      mockSnapController.handleRequest.mockReturnValueOnce({
        pending: false,
        result: mockExpectedUserOp,
      });

      await keyring.prepareUserOperation(
        accounts[0].address,
        mockIntents,
        executionContext,
      );

      expect(mockSnapController.handleRequest).toHaveBeenCalledWith({
        handler: 'onKeyringRequest',
        origin: 'metamask',
        request: {
          id: expect.any(String),
          jsonrpc: '2.0',
          method: 'keyring_submitRequest',
          params: {
            id: expect.any(String),
            scope: toCaipChainId(CaipNamespaces.Eip155, executionContext.chainId),
            account: accounts[0].id,
            request: {
              method: 'eth_prepareUserOperation',
              params: mockIntents,
            },
          },
        },
        snapId: 'local:snap.mock',
      });
    });

    it('throws error if an pending response is returned from the snap', async () => {
      mockSnapController.handleRequest.mockReturnValueOnce({
        pending: true,
      });

      await expect(
        keyring.prepareUserOperation(
          accounts[0].address,
          mockIntents,
          executionContext,
        ),
      ).rejects.toThrow(regexForUUIDInRequiredSyncErrorMessage);
    });
  });

  describe('patchUserOperation', () => {
    const mockUserOp: EthUserOperation = {
      sender: accounts[0].address,
      callData: '0x70641a22000000000000000000000000f3de3c0d654fda23da',
      initCode: '0x',
      nonce: '0x1',
      callGasLimit: '0x58a83',
      verificationGasLimit: '0xe8c4',
      preVerificationGas: '0xc57c',
      maxFeePerGas: '0x87f0878c0',
      maxPriorityFeePerGas: '0x1dcd6500',
      signature: '0x',
      paymasterAndData: '0x',
    };

    const mockExpectedPatch: EthUserOperationPatch = {
      paymasterAndData: '0x1234',
    };

    it('calls eth_patchUserOperation', async () => {
      mockSnapController.handleRequest.mockReturnValueOnce({
        pending: false,
        result: mockExpectedPatch,
      });

      await keyring.patchUserOperation(
        accounts[0].address,
        mockUserOp,
        executionContext,
      );

      expect(mockSnapController.handleRequest).toHaveBeenCalledWith({
        handler: 'onKeyringRequest',
        origin: 'metamask',
        request: {
          id: expect.any(String),
          jsonrpc: '2.0',
          method: 'keyring_submitRequest',
          params: {
            id: expect.any(String),
            scope: toCaipChainId(CaipNamespaces.Eip155, executionContext.chainId),
            account: accounts[0].id,
            request: {
              method: 'eth_patchUserOperation',
              params: [mockUserOp],
            },
          },
        },
        snapId: 'local:snap.mock',
      });
    });

    it('throws error if an pending response is returned from the snap', async () => {
      mockSnapController.handleRequest.mockReturnValueOnce({
        pending: true,
      });

      await expect(
        keyring.patchUserOperation(
          accounts[0].address,
          mockUserOp,
          executionContext,
        ),
      ).rejects.toThrow(regexForUUIDInRequiredSyncErrorMessage);
    });
  });
});
