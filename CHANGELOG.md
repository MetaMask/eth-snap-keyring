# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2]
### Uncategorized
- refactor: sync all accounts on snap notificaiton ([#36](https://github.com/MetaMask/eth-snap-keyring/pull/36))
- chore: remove unused `#listAccounts()` method ([#35](https://github.com/MetaMask/eth-snap-keyring/pull/35))
- docs: update API links on `README` ([#34](https://github.com/MetaMask/eth-snap-keyring/pull/34))
- chore: don't sync accounts twice on deletion ([#32](https://github.com/MetaMask/eth-snap-keyring/pull/32))
- chore(deps): bump snaps dependencies to `0.35.2-flask.1` ([#33](https://github.com/MetaMask/eth-snap-keyring/pull/33))

## [0.1.1]
### Changed
- Use objects in snap -> controller methods. ([#28](https://github.com/MetaMask/eth-snap-keyring/pull/28))
- Fix circular call when handling `'read'` requests. ([#27](https://github.com/MetaMask/eth-snap-keyring/pull/27))
- Remove `saveSnapKeyring` argument from `handleKeyringSnapMessage`. ([#26](https://github.com/MetaMask/eth-snap-keyring/pull/26))

## [0.1.0]
### Added
- Initial release.

[Unreleased]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/MetaMask/eth-snap-keyring/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/MetaMask/eth-snap-keyring/releases/tag/v0.1.0
