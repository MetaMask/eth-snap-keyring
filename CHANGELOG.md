# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0]
### Uncategorized
- chore(deps): bump @metamask/key-tree from 7.0.0 to 7.1.1 ([#22](https://github.com/MetaMask/eth-snap-keyring/pull/22))
- chore(deps): bump @metamask/utils from 5.0.0 to 6.1.0 ([#23](https://github.com/MetaMask/eth-snap-keyring/pull/23))
- Add unit tests and types file ([#20](https://github.com/MetaMask/eth-snap-keyring/pull/20))
- Bump `keyring-api` to version `0.1.0` ([#21](https://github.com/MetaMask/eth-snap-keyring/pull/21))
- chore: remove traces and use vararg in `syncAccounts`
- feat: support eth_sign and document methods
- chore: document methods
- fix: add workaround for `removeAccount` not being awaited
- chore: add traces
- chore: add traces
- chore: add traces
- chore: add traces
- fix: fix serialization and replace maps with objects
- Revert "fix: don't sync account during deserialization"
- chore: add traces
- chore: add traces
- fix: don't sync account during deserialization
- chore: don't sync accounts on deserialization
- chore: add trace
- chore: disable deserialization (test)
- fix: only replace list of snaps if successfully deserialize state
- chore: move sync accounts into try block
- chore: remove traces and catch deserialization errors
- chore: add trace
- feat: serialize keyring
- chore: remove traces and ignore inital state
- fix: allow snaps list to be empty
- chore: add traces
- chore: add traces
- chore: make `getAccount` synchronous
- fix: await on listAccounts
- chore: add traces
- feat: use `syncAccounts()` method
- feat: use keyring API
- wip: archive work in progress
- chore: update `yarn.lock`
- chore: rename `keyring-api` dependency
- chore: add type to snap controller
- chore: remove some unused types
- fix bigint to string
- bump dep
- remove deserialize error
- add test
- add dep
- add signedTyped message test
- add tests for signTransaction
- update payload order
- set default for params, rename approve method
- add sign typed
- ignore private
- Revert "chore: rename keyring snap methods"
- refactor
- support legacy tx
- fix create account error
- add BN.js and change return from signTransaction
- chore: rename keyring snap methods
- downgrade ethereumjs/tx
- get signing directly from snap
- fix deserialize
- add get snapIdFromAddress and force address key to be all lowercase
- chore: change debug message to log request
- chore: print reference to `snapController`
- fix: rename `submitRequest` method
- chore: fix prettier warning
- chore: use Address type for addresses
- refactor: use SnapId instead of Origin when applicable
- chore: fix eslint warnings
- chore: do not export decodeSignature
- fix: use JSON-RPC notification instead of request and fix warnings
- chore: export SnapKeyrin
- chore: remove some dead code
- add tests
- chore: document DeferredPromise class
- chore: fix some more linting errors
- chore: fix linting errors and send-to-snap refactor
- chore: fix lint warnings
- Revert "chore: add dist"
- fix: check if resolve is defined
- chore: enable skipLibCheck
- chore: add dist
- chore: remove extra empty line
- chore: fix typo
- chore: disable exactOptionalPropertyTypes
- chore: remove globalThis
- chore: add uuid types
- chore: add files from proof-of-concept
- chore: start to update the README and package links
- Initial commit

[Unreleased]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MetaMask/eth-snap-keyring/releases/tag/v0.1.0
