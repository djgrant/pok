# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Command examples and description fields** - Commands can now specify `examples` (array of usage examples) and `description` (extended help text) in their configuration for enhanced `--help` output
- **PowerShell shell completion** - Added PowerShell completion script generation via `mycli completion powershell`
- **Testing guide** - New `docs/testing.md` covering testing patterns with `createRawPrompter`, `createRawReporterAdapter`, mocking environment resolvers, and end-to-end command testing
