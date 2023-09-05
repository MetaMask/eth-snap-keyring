# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0]
### Changed
- refactor: add account and snap metadata ([#75](https://github.com/MetaMask/eth-snap-keyring/pull/75))
- chore(deps): bump @metamask/approval-controller from 3.4.0 to 3.5.1 ([#67](https://github.com/MetaMask/eth-snap-keyring/pull/67))
- chore(deps): bump @metamask/post-message-stream from 6.1.2 to 6.2.0 ([#74](https://github.com/MetaMask/eth-snap-keyring/pull/74))
- chore(deps-dev): bump @metamask/auto-changelog from 3.1.0 to 3.2.0 ([#56](https://github.com/MetaMask/eth-snap-keyring/pull/56))
- devDeps: lavamoat-allow-scripts@^2.0.3->^2.3.1 ([#71](https://github.com/MetaMask/eth-snap-keyring/pull/71))
- chore(deps): bump word-wrap from 1.2.3 to 1.2.4 ([#59](https://github.com/MetaMask/eth-snap-keyring/pull/59))
- chore(deps): bump semver from 6.3.0 to 6.3.1 ([#55](https://github.com/MetaMask/eth-snap-keyring/pull/55))
- chore(deps): bump ses from 0.18.2 to 0.18.7 ([#62](https://github.com/MetaMask/eth-snap-keyring/pull/62))
- chore(deps): bump @metamask/approval-controller from 3.3.0 to 3.4.0 ([#44](https://github.com/MetaMask/eth-snap-keyring/pull/44))
- refactor: rename files to be more idiomatic ([#42](https://github.com/MetaMask/eth-snap-keyring/pull/42))
- refactor: move internal state from objects to maps ([#41](https://github.com/MetaMask/eth-snap-keyring/pull/41))

### Fixed
- fix: remove promise if `submitRequest()` throws ([#43](https://github.com/MetaMask/eth-snap-keyring/pull/43))

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

[Unreleased]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/MetaMask/eth-snap-keyring/releases/tag/v0.1.0
