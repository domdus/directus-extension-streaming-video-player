# Changelog

All notable changes to this project are documented in this file.

## [1.0.13] - 2026-08-26

### Added

- **Storage Location** field option for file fields — set a storage adapter for uploads in Data Model (optional; empty uses the project default).
- Upload preset passes the configured storage to Directus `v-upload`.

### Changed

- Folder and Storage Location field options now share one row (`half` width each), matching native file interfaces.

## [1.0.12] - 2026-07-24

### Fixed

- Private asset playback by attaching Studio `access_token` to same-origin `/assets/` media URLs (video, HLS, and DASH segment loaders).
