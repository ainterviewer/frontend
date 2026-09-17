// Text for the "Report this question" flow shown during an interview.
//
// Owned by the frontend and selected by language, exactly like `modalText.ts`
// (there is no i18n framework in this repo); unknown languages fall back to
// English. The languages mirror those supported by `SurveyItem.svelte`.
//
// The reason keys are the generated `ReportReason` union, so a reason added on
// the backend fails to type-check here until it has copy in every language --
// which is the point. A respondent being asked something offensive should not
// be shown an untranslated label.

import type { ReportReason } from '$lib/api';

export interface ReportText {
	/** Tooltip and accessible name of the flag button beside a question. */
	trigger_label: string;
	title: string;
	intro: string;
	reasons: Record<ReportReason, string>;
	comment_label: string;
	comment_placeholder: string;
	/** Shown under the textarea when `other` is chosen, which says nothing alone. */
	comment_required_hint: string;
	cancel: string;
	submit: string;
	submitting: string;
	error: string;
	/** The acknowledgement, and the skip the respondent may decline. */
	thanks_title: string;
	thanks_text: string;
	skip_prompt: string;
	skip_confirm: string;
	skip_decline: string;
	/** Dismisses the acknowledgement when there is no skip to offer. */
	close: string;
}

type Lang = 'EN' | 'DA' | 'DE' | 'ES' | 'FR';

const REPORT: Record<Lang, ReportText> = {
	EN: {
		trigger_label: 'Report this question',
		title: 'Report this question',
		intro:
			'Let the research team know what is wrong with this question. Your report is read alongside the interview.',
		reasons: {
			inappropriate: 'Inappropriate',
			offensive: 'Offensive',
			irrelevant: 'Irrelevant',
			other: 'Something else'
		},
		comment_label: 'Anything you would like to add? (optional)',
		comment_placeholder: 'Tell us more about what is wrong with this question…',
		comment_required_hint: 'Please tell us briefly what is wrong.',
		cancel: 'Cancel',
		submit: 'Report',
		submitting: 'Reporting…',
		error: 'Your report could not be sent. Please try again.',
		thanks_title: 'Thank you',
		thanks_text: 'Your report has been recorded and will be reviewed.',
		skip_prompt: 'Would you like to skip this question?',
		skip_confirm: 'Skip the question',
		skip_decline: 'Answer it anyway',
		close: 'Close'
	},
	DA: {
		trigger_label: 'Rapportér dette spørgsmål',
		title: 'Rapportér dette spørgsmål',
		intro:
			'Fortæl forskerholdet, hvad der er galt med dette spørgsmål. Din rapport læses sammen med interviewet.',
		reasons: {
			inappropriate: 'Upassende',
			offensive: 'Krænkende',
			irrelevant: 'Irrelevant',
			other: 'Noget andet'
		},
		comment_label: 'Er der noget, du vil tilføje? (valgfrit)',
		comment_placeholder: 'Fortæl os mere om, hvad der er galt med dette spørgsmål…',
		comment_required_hint: 'Fortæl os kort, hvad der er galt.',
		cancel: 'Annullér',
		submit: 'Rapportér',
		submitting: 'Rapporterer…',
		error: 'Din rapport kunne ikke sendes. Prøv venligst igen.',
		thanks_title: 'Tak',
		thanks_text: 'Din rapport er gemt og vil blive gennemgået.',
		skip_prompt: 'Vil du springe dette spørgsmål over?',
		skip_confirm: 'Spring spørgsmålet over',
		skip_decline: 'Svar alligevel',
		close: 'Luk'
	},
	DE: {
		trigger_label: 'Diese Frage melden',
		title: 'Diese Frage melden',
		intro:
			'Teilen Sie dem Forschungsteam mit, was an dieser Frage falsch ist. Ihre Meldung wird zusammen mit dem Interview gelesen.',
		reasons: {
			inappropriate: 'Unangemessen',
			offensive: 'Beleidigend',
			irrelevant: 'Irrelevant',
			other: 'Etwas anderes'
		},
		comment_label: 'Möchten Sie etwas hinzufügen? (optional)',
		comment_placeholder: 'Erzählen Sie uns mehr darüber, was an dieser Frage falsch ist…',
		comment_required_hint: 'Bitte teilen Sie uns kurz mit, was falsch ist.',
		cancel: 'Abbrechen',
		submit: 'Melden',
		submitting: 'Wird gemeldet…',
		error: 'Ihre Meldung konnte nicht gesendet werden. Bitte versuchen Sie es erneut.',
		thanks_title: 'Vielen Dank',
		thanks_text: 'Ihre Meldung wurde gespeichert und wird geprüft.',
		skip_prompt: 'Möchten Sie diese Frage überspringen?',
		skip_confirm: 'Frage überspringen',
		skip_decline: 'Trotzdem beantworten',
		close: 'Schließen'
	},
	ES: {
		trigger_label: 'Denunciar esta pregunta',
		title: 'Denunciar esta pregunta',
		intro:
			'Cuéntale al equipo de investigación qué le pasa a esta pregunta. Tu denuncia se lee junto con la entrevista.',
		reasons: {
			inappropriate: 'Inapropiada',
			offensive: 'Ofensiva',
			irrelevant: 'Irrelevante',
			other: 'Otra cosa'
		},
		comment_label: '¿Quieres añadir algo? (opcional)',
		comment_placeholder: 'Cuéntanos más sobre qué le pasa a esta pregunta…',
		comment_required_hint: 'Cuéntanos brevemente qué le pasa.',
		cancel: 'Cancelar',
		submit: 'Denunciar',
		submitting: 'Enviando…',
		error: 'No se pudo enviar tu denuncia. Inténtalo de nuevo.',
		thanks_title: 'Gracias',
		thanks_text: 'Tu denuncia se ha registrado y será revisada.',
		skip_prompt: '¿Quieres omitir esta pregunta?',
		skip_confirm: 'Omitir la pregunta',
		skip_decline: 'Responder de todos modos',
		close: 'Cerrar'
	},
	FR: {
		trigger_label: 'Signaler cette question',
		title: 'Signaler cette question',
		intro:
			"Indiquez à l'équipe de recherche ce qui ne va pas avec cette question. Votre signalement est lu avec l'entretien.",
		reasons: {
			inappropriate: 'Inappropriée',
			offensive: 'Offensante',
			irrelevant: 'Hors sujet',
			other: 'Autre chose'
		},
		comment_label: 'Souhaitez-vous ajouter quelque chose ? (facultatif)',
		comment_placeholder: 'Dites-nous en plus sur ce qui ne va pas avec cette question…',
		comment_required_hint: 'Dites-nous brièvement ce qui ne va pas.',
		cancel: 'Annuler',
		submit: 'Signaler',
		submitting: 'Envoi…',
		error: "Votre signalement n'a pas pu être envoyé. Veuillez réessayer.",
		thanks_title: 'Merci',
		thanks_text: 'Votre signalement a été enregistré et sera examiné.',
		skip_prompt: 'Souhaitez-vous passer cette question ?',
		skip_confirm: 'Passer la question',
		skip_decline: 'Y répondre quand même',
		close: 'Fermer'
	}
};

/** The order the reasons are offered in, mildest first. */
export const REPORT_REASONS: ReportReason[] = ['irrelevant', 'inappropriate', 'offensive', 'other'];

export function getReportText(lang: string | undefined): ReportText {
	// Language codes come from the backend already uppercased (EN/DA/DE/ES/FR);
	// fall back to English for anything unknown or missing.
	const l: Lang = lang && lang in REPORT ? (lang as Lang) : 'EN';
	return REPORT[l];
}
