# Changelog

Generated from [Conventional Commits](https://www.conventionalcommits.org) by
[git-cliff](https://git-cliff.org). Releases older than the earliest entry below
predate this changelog — see `git log` for their history.

## [0.2.88] - 2026-08-26

### Internal

- Fix broken url in readme

## [0.2.87] - 2026-08-26

### Features

- (email) Implement template substitution in email subject line
- Add link between participants and interviews
- Add resumeable respondent links
- Improved dropout chart with correct section assignment
- Improve monitor card and text styling
- Add question text to dropout hover and improve dropout section hover
- Small improvements to text color in PieChart label

### Bug Fixes

- Harden interview authentication
- Remove unused and redundant guest scope

## [0.2.86] - 2026-08-26

### Features

- Better email template validation
- Improve email template placeholder styling

## [0.2.85] - 2026-08-25

### Features

- (tables) Unify all dashboard tables on TanStack Table v9

### Internal

- Add citation information

## [0.2.84] - 2026-08-21

### Features

- Show a popup for users whos authentication session has expired for an interview

### Bug Fixes

- Remove the flashing loading state on table pagination

### Internal

- Update sdk

## [0.2.83] - 2026-08-21

### Bug Fixes

- Fix filename encoding for bundle downloads

## [0.2.82] - 2026-08-20

### Bug Fixes

- Update opt-out text

## [0.2.81] - 2026-08-20

### Bug Fixes

- Only validate external params for interviewType == "distributed"

## [0.2.80] - 2026-08-20

### Features

- Validate external params as first step when an interview is loaded

## [0.2.79] - 2026-08-20

### Bug Fixes

- Don't show new release notification for only releases with only internal changes

## [0.2.78] - 2026-08-20

### Bug Fixes

- Releases with no highlights now still gets a row indicating that the changes were internal only

## [0.2.77] - 2026-08-19

### Internal

- Update dependencies
- Fix linter

## [0.2.76] - 2026-08-19

### Internal

- Update dependencies

## [0.2.75] - 2026-08-19

### Features

- Improve project language menu so per language controls are more ergonomic

## [0.2.74] - 2026-08-19

### Features

- Add sortable header for participants table

## [0.2.73] - 2026-08-19

### Bug Fixes

- Add skipped blank rows to upload participants toast and allow the user to select ranges with shift

## [0.2.72] - 2026-08-19

### Internal

- Fix linters

## [0.2.71] - 2026-08-19

### Features

- (language) Improve default language control

### Bug Fixes

- Improve size of WhatsNewModal
- Better language resolvement for interviews

## [0.2.70] - 2026-08-14

### Bug Fixes

- (conditions) Improved condition target question resolution
- (lint) Remove stale eslint-disable and remove unused handleConnect stub

## [0.2.69] - 2026-08-14

### Features

- (whats-new) Add platform_version to Whats New modal

## [0.2.68] - 2026-08-14

### Bug Fixes

- (admin) Change default scope for manually approved users to demo from user

## [0.2.67] - 2026-08-14

### Features

- Add link to full release notes in WhatsNewModal

### Bug Fixes

- Change mac shortcut hint from ctrl -> ⌘ in interview

## [0.2.66] - 2026-08-13

### Bug Fixes

- (charts) Adaptive tick display for histograms

## [0.2.65] - 2026-08-13

### Features

- (charts) Add placeholder charts while data loads

## [0.2.64] - 2026-08-13

### Bug Fixes

- Change interview model expected type to str
- Layerchart types updated to match latest version

### Internal

- Update dependencies
- Update dependencies

## [0.2.63] - 2026-08-13

### Bug Fixes

- (release-notes) Improve new notification dot colour and make notes two column layout

## [0.2.62] - 2026-08-13

### Features

- Add 'What's new" so users can follow along as we publish updates to the platform

## [0.2.61] - 2026-08-13

### Bug Fixes

- (interview-setup) External params now works as intended

## [0.2.60] - 2026-08-12

### Features

- (dashboard) Drag and drop projects between folders in the main dashboard

### Internal

- (sdk) The sdk now gets generated from a live endpoint from the backend server
- (justfile) Lint justfile
- Implement cliff and release note strategy
