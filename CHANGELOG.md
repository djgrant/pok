# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`reporter.markdown()`** - Reporters can now emit a markdown document with `r.reporter.markdown(content)`. The raw markdown crosses the event bus and each adapter renders it for its medium: `@pokit/terminal` renders to ANSI (headings, emphasis, syntax-highlighted code fences, lists), and passes raw markdown through unchanged when the output is not a styled TTY (piped, `--no-color`, `NO_COLOR`) so it composes with other tools (`mycli docs | glow`)
- **Command examples and description fields** - Commands can now specify `examples` (array of usage examples) and `description` (extended help text) in their configuration for enhanced `--help` output
- **PowerShell shell completion** - Added PowerShell completion script generation via `mycli completion powershell`
- **Testing guide** - New `docs/testing.md` covering testing patterns with `createRawPrompter`, `createRawReporterAdapter`, mocking environment resolvers, and end-to-end command testing
