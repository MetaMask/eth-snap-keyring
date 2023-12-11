# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.0]

### Uncategorized

- chore(deps): bump @metamask/snaps-sdk from 1.2.0 to 1.3.0 ([#185](https://github.com/MetaMask/eth-snap-keyring/pull/185))
- build: bump min Node version to 18.18 and use LTS for dev ([#183](https://github.com/MetaMask/eth-snap-keyring/pull/183))
- chore(deps): bump @metamask/snaps-controllers from 3.4.1 to 3.5.0 ([#184](https://github.com/MetaMask/eth-snap-keyring/pull/184))
- feat: add methods to support ERC-4337 accounts ([#180](https://github.com/MetaMask/eth-snap-keyring/pull/180))
- chore(deps): bump @metamask/json-rpc-engine from 7.2.0 to 7.3.0 ([#174](https://github.com/MetaMask/eth-snap-keyring/pull/174))
- chore(deps): bump @metamask/snaps-utils from 3.1.0 to 3.3.0 ([#176](https://github.com/MetaMask/eth-snap-keyring/pull/176))
- chore(deps): bump @metamask/providers from 13.0.0 to 13.1.0 ([#167](https://github.com/MetaMask/eth-snap-keyring/pull/167))
- chore(deps-dev): bump @metamask/auto-changelog from 3.4.2 to 3.4.3 ([#173](https://github.com/MetaMask/eth-snap-keyring/pull/173))
- chore(deps): bump @metamask/utils from 8.2.0 to 8.2.1 ([#175](https://github.com/MetaMask/eth-snap-keyring/pull/175))
- chore(deps): bump @metamask/snaps-rpc-methods from 3.1.0 to 3.3.0 ([#177](https://github.com/MetaMask/eth-snap-keyring/pull/177))
- chore(deps): bump @metamask/eth-sig-util from 7.0.0 to 7.0.1 ([#178](https://github.com/MetaMask/eth-snap-keyring/pull/178))
- chore(deps): bump @metamask/snaps-registry from 2.1.0 to 2.1.1 ([#179](https://github.com/MetaMask/eth-snap-keyring/pull/179))
- feat: use a `snapId`-indexed map ([#172](https://github.com/MetaMask/eth-snap-keyring/pull/172))
- deps: @metamask/keyring-api@^1.0.0->^1.1.0 ([#166](https://github.com/MetaMask/eth-snap-keyring/pull/166))
- chore(deps-dev): bump @metamask/auto-changelog from 3.3.0 to 3.4.2 ([#162](https://github.com/MetaMask/eth-snap-keyring/pull/162))
- chore(deps): bump @metamask/object-multiplex from 1.2.0 to 1.3.0 ([#163](https://github.com/MetaMask/eth-snap-keyring/pull/163))
- chore(deps): bump @metamask/snaps-ui from 3.0.0 to 3.0.1 ([#157](https://github.com/MetaMask/eth-snap-keyring/pull/157))
- chore(deps): bump @metamask/utils from 8.1.0 to 8.2.0 ([#156](https://github.com/MetaMask/eth-snap-keyring/pull/156))
- chore(deps): bump @metamask/json-rpc-engine from 7.1.1 to 7.2.0 ([#154](https://github.com/MetaMask/eth-snap-keyring/pull/154))
- chore(deps): bump @metamask/snaps-registry from 2.0.0 to 2.1.0 ([#147](https://github.com/MetaMask/eth-snap-keyring/pull/147))
- ci: update CODEOWNERS and run CI on merge queues ([#165](https://github.com/MetaMask/eth-snap-keyring/pull/165))
- chore(deps): bump @babel/traverse from 7.22.5 to 7.23.2 ([#151](https://github.com/MetaMask/eth-snap-keyring/pull/151))

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

[Unreleased]: https://github.com/MetaMask/eth-snap-keyring/compare/v2.1.0...HEAD
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
