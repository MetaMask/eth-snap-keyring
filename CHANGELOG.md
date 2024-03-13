# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.2]

### Changed

- Bump @metamask/safe-event-emitter from 3.1.0 to 3.1.1 ([#251](https://github.com/MetaMask/eth-snap-keyring/pull/251))
- Bump dependencies ([#246](https://github.com/MetaMask/eth-snap-keyring/pull/246))
- Bump @metamask/safe-event-emitter from 3.0.0 to 3.1.0 ([#245](https://github.com/MetaMask/eth-snap-keyring/pull/245))
- Fix enforcing responses of `prepareUserOperation` and `patchUserOperation` to be synchronous ([#243](https://github.com/MetaMask/eth-snap-keyring/pull/243))
- Bump @metamask/snaps-registry from 3.0.0 to 3.0.1 ([#244](https://github.com/MetaMask/eth-snap-keyring/pull/244))

## [2.2.1]

### Changed

- Bump @metamask dependencies ([#236](https://github.com/MetaMask/eth-snap-keyring/pull/236))
- Extract logic in 'submitRequest' ([#232](https://github.com/MetaMask/eth-snap-keyring/pull/232))
- Bump @metamask/controller-utils from 8.0.3 to 8.0.4 ([#233](https://github.com/MetaMask/eth-snap-keyring/pull/233))
- Bump @metamask/json-rpc-engine from 7.3.2 to 7.3.3 ([#234](https://github.com/MetaMask/eth-snap-keyring/pull/234))
- Bump @metamask/approval-controller from 5.1.2 to 5.1.3 ([#235](https://github.com/MetaMask/eth-snap-keyring/pull/235))
- Bump update Snap and dev dependencies ([#230](https://github.com/MetaMask/eth-snap-keyring/pull/230))
- Bump @metamask/rpc-errors from 6.2.0 to 6.2.1 ([#223](https://github.com/MetaMask/eth-snap-keyring/pull/223))
- Bump @metamask/snaps-utils from 6.1.0 to 7.0.0 ([#224](https://github.com/MetaMask/eth-snap-keyring/pull/224))
- Bump @metamask/rpc-errors from 6.1.0 to 6.2.0 ([#219](https://github.com/MetaMask/eth-snap-keyring/pull/219))
- Bump ip from 2.0.0 to 2.0.1 ([#218](https://github.com/MetaMask/eth-snap-keyring/pull/218))

### Fixed

- Add `chainId` to Keyring API requests (transaction/typed message) ([#231](https://github.com/MetaMask/eth-snap-keyring/pull/231))
- Enforce async request redirect URL is in the snaps 'allowedOrigins' ([#228](https://github.com/MetaMask/eth-snap-keyring/pull/228))

## [2.2.0]

### Changed

- Bump dependencies ([#220](https://github.com/MetaMask/eth-snap-keyring/pull/220))
  - @metamask/snaps-controllers from ^4.1.0 to ^5.0.1
  - @metamask/snaps-sdk from ^1.4.0 to ^2.1.0
  - @metamask/snaps-utils from ^5.2.0 to ^6.1.0
  - @metamask/utils from ^8.1.0 to ^8.3.0
  - @metamask/keyring-api from ^2.0.0 to ^4.0.0

## [2.1.2]

### Fixed

- Fixed inconsistent signature signing ([#200](https://github.com/MetaMask/eth-snap-keyring/pull/200))

## [2.1.1]

### Fixed

- Reject unsupported account methods ([#190](https://github.com/MetaMask/eth-snap-keyring/pull/190))

## [2.1.0]

### Added

- Add methods to support ERC-4337 accounts ([#180](https://github.com/MetaMask/eth-snap-keyring/pull/180)).

### Changed

- Use a `snapId`-indexed map ([#172](https://github.com/MetaMask/eth-snap-keyring/pull/172)).
- Update CODEOWNERS and run CI on merge queues ([#165](https://github.com/MetaMask/eth-snap-keyring/pull/165)).
- Bump min Node version to 18.18 and use LTS for dev ([#183](https://github.com/MetaMask/eth-snap-keyring/pull/183)).

## [2.0.0]

### Changed

- BREAKING: Remove async from `listAccounts` and `getAccountByAddress` ([#148](https://github.com/MetaMask/eth-snap-keyring/pull/148)).

## [1.0.0]

### Changed

- Bump `@metamask/keyring-api` to 1.0.0 ([#145](https://github.com/MetaMask/eth-snap-keyring/pull/145)).
- Bump `semver` and `word-wrap` dependencies ([#144](https://github.com/MetaMask/eth-snap-keyring/pull/144)).
- Bump @metamask/rpc-errors from 6.0.0 to 6.1.0 ([#143](https://github.com/MetaMask/eth-snap-keyring/pull/143)).

## [1.0.0-rc.2]

### Added

- Add `redirectUser` callback ([#136](https://github.com/MetaMask/eth-snap-keyring/pull/136)).

## [1.0.0-rc.1]

### Added

- Add `getAccountByAddress` method ([#134](https://github.com/MetaMask/eth-snap-keyring/pull/134)).

### Changed

- Bump `word-wrap` and `semver` ([#140](https://github.com/MetaMask/eth-snap-keyring/pull/140)).
- Bump `@metamask/scure-bip39` from 2.1.0 to 2.1.1 ([#133](https://github.com/MetaMask/eth-snap-keyring/pull/133)).
- Bump `postcss` from 8.4.20 to 8.4.31 ([#137](https://github.com/MetaMask/eth-snap-keyring/pull/137)).
- Bump `@metamask` dependencies ([#139](https://github.com/MetaMask/eth-snap-keyring/pull/139)).

## [0.3.1]

### Added

- Add the `getAccountsBySnapId` method ([#122](https://github.com/MetaMask/eth-snap-keyring/pull/122)).

### Fixed

- Remove the `removeAccountsBySnapId` method ([#121](https://github.com/MetaMask/eth-snap-keyring/pull/121)).
- Call external function with lowercase address ([#120](https://github.com/MetaMask/eth-snap-keyring/pull/120)).

## [0.3.0]

### Changed

- Handle approval when adding/removing account with `handleUserInput` callback ([#99](https://github.com/MetaMask/eth-snap-keyring/pull/99)).

## [0.2.3]

### Added

- Add method to remove all accounts given a snap ID ([#116](https://github.com/MetaMask/eth-snap-keyring/pull/116)).

### Fixed

- Don't allow duplicate accounts to be added ([#115](https://github.com/MetaMask/eth-snap-keyring/pull/115)).
- Ignore event if account was already removed ([#101](https://github.com/MetaMask/eth-snap-keyring/pull/101)).

## [0.2.2]

### Changed

- Add `removeAccount` callback to constructor ([#96](https://github.com/MetaMask/eth-snap-keyring/pull/96)).

## [0.2.1]

### Changed

- Add `callbacks` argument to constructor ([#82](https://github.com/MetaMask/eth-snap-keyring/pull/82)).
- Increase minimum Node.js version to 16 (default to 18) ([#83](https://github.com/MetaMask/eth-snap-keyring/pull/83)).
- Migrate to the new `keyring-api` ([#78](https://github.com/MetaMask/eth-snap-keyring/pull/78)).
- Upgrade dependencies.

## [0.2.0]

### Changed

- Add account and snap metadata ([#75](https://github.com/MetaMask/eth-snap-keyring/pull/75)).
- Rename files to be more idiomatic ([#42](https://github.com/MetaMask/eth-snap-keyring/pull/42)).
- Move internal state from objects to maps ([#41](https://github.com/MetaMask/eth-snap-keyring/pull/41)).

### Fixed

- Remove promise if `submitRequest()` throws ([#43](https://github.com/MetaMask/eth-snap-keyring/pull/43)).

## [0.1.4]

### Changed

- BREAKING: Add `callbacks` that will be used to inject dependencies ([#79](https://github.com/MetaMask/eth-snap-keyring/pull/79), [MetaMask/snaps#1725](https://github.com/MetaMask/snaps/pull/1725), [MetaMask/metamask-extension#20786](https://github.com/MetaMask/metamask-extension/pull/20786)).

## [0.1.3]

### Fixed

- Remove account from maps before calling the snap ([#39](https://github.com/MetaMask/eth-snap-keyring/pull/39)).

## [0.1.2]

### Changed

- Remove unused `#listAccounts()` method ([#35](https://github.com/MetaMask/eth-snap-keyring/pull/35)).

### Fixed

- Sync all accounts on snap notificaiton ([#36](https://github.com/MetaMask/eth-snap-keyring/pull/36)).
- Don't sync accounts twice on deletion ([#32](https://github.com/MetaMask/eth-snap-keyring/pull/32)).

## [0.1.1]

### Changed

- Use objects in snap -> controller methods ([#28](https://github.com/MetaMask/eth-snap-keyring/pull/28)).
- Fix circular call when handling `'read'` requests ([#27](https://github.com/MetaMask/eth-snap-keyring/pull/27)).
- Remove `saveSnapKeyring` argument from `handleKeyringSnapMessage` ([#26](https://github.com/MetaMask/eth-snap-keyring/pull/26)).

## [0.1.0]

### Added

- Initial release.

[Unreleased]: https://github.com/MetaMask/eth-snap-keyring/compare/v2.2.2...HEAD
[2.2.2]: https://github.com/MetaMask/eth-snap-keyring/compare/v2.2.1...v2.2.2
[2.2.1]: https://github.com/MetaMask/eth-snap-keyring/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/MetaMask/eth-snap-keyring/compare/v2.1.2...v2.2.0
[2.1.2]: https://github.com/MetaMask/eth-snap-keyring/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/MetaMask/eth-snap-keyring/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/MetaMask/eth-snap-keyring/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/MetaMask/eth-snap-keyring/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/MetaMask/eth-snap-keyring/compare/v1.0.0-rc.2...v1.0.0
[1.0.0-rc.2]: https://github.com/MetaMask/eth-snap-keyring/compare/v1.0.0-rc.1...v1.0.0-rc.2
[1.0.0-rc.1]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.3.1...v1.0.0-rc.1
[0.3.1]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/MetaMask/eth-snap-keyring/releases/tag/v0.1.0
