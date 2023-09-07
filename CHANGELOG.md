# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.4]
### Changed
- Receive a callback to trigger `saveState`

## [0.1.3]
### Fixed
- Remove account from maps before calling the snap. ([#39](https://github.com/MetaMask/eth-snap-keyring/pull/39))

## [0.1.2]
### Changed
- Remove unused `#listAccounts()` method. ([#35](https://github.com/MetaMask/eth-snap-keyring/pull/35))

### Fixed
- Sync all accounts on snap notificaiton. ([#36](https://github.com/MetaMask/eth-snap-keyring/pull/36))
- Don't sync accounts twice on deletion. ([#32](https://github.com/MetaMask/eth-snap-keyring/pull/32))

## [0.1.1]
### Changed
- Use objects in snap -> controller methods. ([#28](https://github.com/MetaMask/eth-snap-keyring/pull/28))
- Fix circular call when handling `'read'` requests. ([#27](https://github.com/MetaMask/eth-snap-keyring/pull/27))
- Remove `saveSnapKeyring` argument from `handleKeyringSnapMessage`. ([#26](https://github.com/MetaMask/eth-snap-keyring/pull/26))

## [0.1.0]
### Added
- Initial release.

[Unreleased]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/MetaMask/eth-snap-keyring/releases/tag/v0.1.0
