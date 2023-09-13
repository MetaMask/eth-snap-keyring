# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/MetaMask/eth-snap-keyring/releases/tag/v0.1.0
