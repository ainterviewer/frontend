// Fixed text respondents see, in the languages it is written in by hand.
// See `lang.ts` for which those are and how a project language resolves.

export { type Lang, LANGS, toLang } from './lang';
export { getModalText, type ModalText } from './modalText';
export { getReportText, REPORT_REASONS, type ReportText } from './reportText';
export { getSecurityText, type SecurityText } from './securityText';
export { getUiText, splitWithdraw, type UiText } from './ui';
