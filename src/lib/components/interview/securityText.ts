// Text for the modal a security intervention is shown in.
//
// The intervention's own message is written by the project and arrives with it;
// only the title and the buttons are owned here. Like `modalText.ts`, selected
// by language with an English fallback.

import type { SecurityIntervention } from '$lib/api';

type Lang = 'EN' | 'DA' | 'DE' | 'ES' | 'FR';
type Action = SecurityIntervention['action'];

export interface SecurityText {
	title: string;
	/** Closes an intervention the respondent cannot override. */
	acknowledge: string;
	/** Per action: let it go ahead, or carry on as before. */
	accept: Record<Action, string>;
	override: Record<Action, string>;
}

const TEXT: Record<Lang, SecurityText> = {
	EN: {
		title: 'Safety check',
		acknowledge: 'OK',
		accept: {
			end_interview: 'End the interview',
			skip_section: 'Move on to the next topic',
			skip_probes: 'Move on to the next question'
		},
		override: {
			end_interview: 'Continue the interview',
			skip_section: 'Keep going with this topic',
			skip_probes: 'Keep answering this question'
		}
	},
	DA: {
		title: 'Sikkerhedstjek',
		acknowledge: 'OK',
		accept: {
			end_interview: 'Afslut interviewet',
			skip_section: 'Gå videre til næste emne',
			skip_probes: 'Gå videre til næste spørgsmål'
		},
		override: {
			end_interview: 'Fortsæt interviewet',
			skip_section: 'Bliv ved dette emne',
			skip_probes: 'Bliv ved dette spørgsmål'
		}
	},
	DE: {
		title: 'Sicherheitsprüfung',
		acknowledge: 'OK',
		accept: {
			end_interview: 'Interview beenden',
			skip_section: 'Zum nächsten Thema',
			skip_probes: 'Zur nächsten Frage'
		},
		override: {
			end_interview: 'Interview fortsetzen',
			skip_section: 'Bei diesem Thema bleiben',
			skip_probes: 'Bei dieser Frage bleiben'
		}
	},
	ES: {
		title: 'Control de seguridad',
		acknowledge: 'Aceptar',
		accept: {
			end_interview: 'Terminar la entrevista',
			skip_section: 'Pasar al siguiente tema',
			skip_probes: 'Pasar a la siguiente pregunta'
		},
		override: {
			end_interview: 'Continuar la entrevista',
			skip_section: 'Seguir con este tema',
			skip_probes: 'Seguir con esta pregunta'
		}
	},
	FR: {
		title: 'Contrôle de sécurité',
		acknowledge: 'OK',
		accept: {
			end_interview: "Terminer l'entretien",
			skip_section: 'Passer au thème suivant',
			skip_probes: 'Passer à la question suivante'
		},
		override: {
			end_interview: "Poursuivre l'entretien",
			skip_section: 'Rester sur ce thème',
			skip_probes: 'Rester sur cette question'
		}
	}
};

export function getSecurityText(lang: string | undefined): SecurityText {
	// Language codes come from the backend already uppercased (EN/DA/DE/ES/FR).
	const l: Lang = lang && lang in TEXT ? (lang as Lang) : 'EN';
	return TEXT[l];
}
