// The fixed text on the screens a respondent goes through: the consent and
// welcome dialogs, the chat's controls and the survey items asked in it.
//
// Text the project writes (titles, messages, questions) is not here; this is
// everything around it. Select with `getUiText(lang)`. Every language must
// have every key, so a string added in English fails to type-check until it
// is translated.

import { type Lang, toLang } from './lang';

export interface UiText {
	welcome: {
		/** Contains `{email}`, where the contact address is shown as a link. */
		withdraw: string;
		store_code: string;
		start: string;
		video_unsupported: string;
	};
	consent: {
		accept: string;
		decline: string;
	};
	chat: {
		send: string;
		/** Tooltip on Send, given the keyboard shortcut. */
		send_title: (shortcut: string) => string;
		message_placeholder: string;
		skip: string;
		skip_title: string;
	};
	survey: {
		pickValue: string;
		chooseOne: string;
		enterNumber: string;
		pickDate: string;
		pickDateTime: string;
		pickTime: string;
		selectMultiple: string;
		other: string;
		pleaseSpecify: string;
		mustBeAtLeast: string;
		mustBeAtMost: string;
		pleaseProvideValue: string;
	};
	grid: {
		rateEach: string;
		required: string;
		submit: string;
		clear: string;
	};
}

const UI: Record<Lang, UiText> = {
	EN: {
		welcome: {
			withdraw:
				'If you wish to withdraw your consent or change your answers, please contact {email} with a reference to the following code:',
			store_code:
				'It is your own responsibility to store this code securely before starting the interview. It is the only way for us to identify and modify or delete your data.',
			start: 'Start interview',
			video_unsupported: 'Your browser cannot play this video.'
		},
		consent: { accept: 'Accept', decline: 'Decline' },
		chat: {
			send: 'Send',
			send_title: (shortcut) => `Send message (${shortcut})`,
			message_placeholder: 'Message',
			skip: 'Skip',
			skip_title: 'Skip this question'
		},
		survey: {
			pickValue: 'Pick a value',
			chooseOne: 'Choose one',
			enterNumber: 'Enter a number',
			pickDate: 'Pick a date',
			pickDateTime: 'Pick a date and time',
			pickTime: 'Pick a time',
			selectMultiple: 'Select multiple',
			other: 'Other',
			pleaseSpecify: 'Please specify...',
			mustBeAtLeast: 'Must be at least',
			mustBeAtMost: 'Must be at most',
			pleaseProvideValue: 'Please provide a value'
		},
		grid: { rateEach: 'Rate each', required: 'Required', submit: 'Submit answers', clear: 'Clear' }
	},
	DA: {
		welcome: {
			withdraw:
				'Hvis du ønsker at trække dit samtykke tilbage eller ændre dine svar, bedes du kontakte {email} med henvisning til følgende kode:',
			store_code:
				'Det er dit eget ansvar at opbevare denne kode sikkert, inden du starter interviewet. Det er den eneste måde, hvorpå vi kan identificere og ændre eller slette dine data.',
			start: 'Start interviewet',
			video_unsupported: 'Din browser kan ikke afspille denne video.'
		},
		consent: { accept: 'Accepter', decline: 'Afvis' },
		chat: {
			send: 'Send',
			send_title: (shortcut) => `Send besked (${shortcut})`,
			message_placeholder: 'Besked',
			skip: 'Spring over',
			skip_title: 'Spring dette spørgsmål over'
		},
		survey: {
			pickValue: 'Vælg en værdi',
			chooseOne: 'Vælg én',
			enterNumber: 'Indtast et tal',
			pickDate: 'Vælg en dato',
			pickDateTime: 'Vælg dato og tid',
			pickTime: 'Vælg et tidspunkt',
			selectMultiple: 'Vælg flere',
			other: 'Andet',
			pleaseSpecify: 'Angiv venligst...',
			mustBeAtLeast: 'Skal mindst være',
			mustBeAtMost: 'Må højst være',
			pleaseProvideValue: 'Angiv venligst en værdi'
		},
		grid: { rateEach: 'Vurder hver', required: 'Påkrævet', submit: 'Send svar', clear: 'Ryd' }
	},
	DE: {
		welcome: {
			withdraw:
				'Wenn Sie Ihre Einwilligung widerrufen oder Ihre Antworten ändern möchten, wenden Sie sich bitte unter Angabe des folgenden Codes an {email}:',
			store_code:
				'Es liegt in Ihrer eigenen Verantwortung, diesen Code vor Beginn des Interviews sicher aufzubewahren. Nur so können wir Ihre Daten identifizieren und ändern oder löschen.',
			start: 'Interview starten',
			video_unsupported: 'Ihr Browser kann dieses Video nicht abspielen.'
		},
		consent: { accept: 'Zustimmen', decline: 'Ablehnen' },
		chat: {
			send: 'Senden',
			send_title: (shortcut) => `Nachricht senden (${shortcut})`,
			message_placeholder: 'Nachricht',
			skip: 'Überspringen',
			skip_title: 'Diese Frage überspringen'
		},
		survey: {
			pickValue: 'Wert auswählen',
			chooseOne: 'Wähle eine Option',
			enterNumber: 'Zahl eingeben',
			pickDate: 'Datum auswählen',
			pickDateTime: 'Datum und Uhrzeit auswählen',
			pickTime: 'Uhrzeit auswählen',
			selectMultiple: 'Mehrere auswählen',
			other: 'Andere',
			pleaseSpecify: 'Bitte angeben...',
			mustBeAtLeast: 'Muss mindestens sein',
			mustBeAtMost: 'Darf höchstens sein',
			pleaseProvideValue: 'Bitte einen Wert angeben'
		},
		grid: {
			rateEach: 'Bewerte jede',
			required: 'Erforderlich',
			submit: 'Antworten senden',
			clear: 'Zurücksetzen'
		}
	},
	ES: {
		welcome: {
			withdraw:
				'Si deseas retirar tu consentimiento o modificar tus respuestas, ponte en contacto con {email} indicando el siguiente código:',
			store_code:
				'Es tu responsabilidad guardar este código en un lugar seguro antes de comenzar la entrevista. Es la única forma que tenemos de identificar y modificar o eliminar tus datos.',
			start: 'Comenzar la entrevista',
			video_unsupported: 'Tu navegador no puede reproducir este vídeo.'
		},
		consent: { accept: 'Aceptar', decline: 'Rechazar' },
		chat: {
			send: 'Enviar',
			send_title: (shortcut) => `Enviar mensaje (${shortcut})`,
			message_placeholder: 'Mensaje',
			skip: 'Omitir',
			skip_title: 'Omitir esta pregunta'
		},
		survey: {
			pickValue: 'Elige un valor',
			chooseOne: 'Elige una opción',
			enterNumber: 'Introduce un número',
			pickDate: 'Elige una fecha',
			pickDateTime: 'Elige fecha y hora',
			pickTime: 'Elige una hora',
			selectMultiple: 'Selecciona varias',
			other: 'Otro',
			pleaseSpecify: 'Por favor, especifica...',
			mustBeAtLeast: 'Debe ser al menos',
			mustBeAtMost: 'Debe ser como máximo',
			pleaseProvideValue: 'Por favor, introduce un valor'
		},
		grid: {
			rateEach: 'Valora cada una',
			required: 'Obligatorio',
			submit: 'Enviar respuestas',
			clear: 'Borrar'
		}
	},
	FR: {
		welcome: {
			withdraw:
				'Si vous souhaitez retirer votre consentement ou modifier vos réponses, veuillez contacter {email} en indiquant le code suivant :',
			store_code:
				"Il vous incombe de conserver ce code en lieu sûr avant de commencer l'entretien. C'est le seul moyen pour nous d'identifier, de modifier ou de supprimer vos données.",
			start: "Commencer l'entretien",
			video_unsupported: 'Votre navigateur ne peut pas lire cette vidéo.'
		},
		consent: { accept: 'Accepter', decline: 'Refuser' },
		chat: {
			send: 'Envoyer',
			send_title: (shortcut) => `Envoyer le message (${shortcut})`,
			message_placeholder: 'Message',
			skip: 'Passer',
			skip_title: 'Passer cette question'
		},
		survey: {
			pickValue: 'Choisissez une valeur',
			chooseOne: 'Choisissez une option',
			enterNumber: 'Entrez un nombre',
			pickDate: 'Choisissez une date',
			pickDateTime: 'Choisissez une date et une heure',
			pickTime: 'Choisissez une heure',
			selectMultiple: 'Sélectionnez plusieurs',
			other: 'Autre',
			pleaseSpecify: 'Veuillez préciser...',
			mustBeAtLeast: 'Doit être au moins',
			mustBeAtMost: 'Doit être au plus',
			pleaseProvideValue: 'Veuillez fournir une valeur'
		},
		grid: {
			rateEach: 'Évaluez chacun',
			required: 'Obligatoire',
			submit: 'Envoyer les réponses',
			clear: 'Effacer'
		}
	}
};

export function getUiText(lang: string | null | undefined): UiText {
	return UI[toLang(lang)];
}

/**
 * The welcome notice split around the contact address, so it can be drawn
 * as a link wherever the language puts it.
 */
export function splitWithdraw(text: string): [before: string, after: string] {
	const i = text.indexOf('{email}');
	return i === -1 ? [text, ''] : [text.slice(0, i), text.slice(i + '{email}'.length)];
}
