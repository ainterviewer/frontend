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
		upload_image: string;
		/** Posted into the conversation when an image upload fails. */
		image_upload_failed: string;
		read_aloud: string;
		stop_reading_aloud: string;
		show_help: string;
		end_interview: string;
		record_audio: string;
	};
	/** The interview's connection, and the screens shown when it cannot go on. */
	connection: {
		reconnecting: string;
		lost: string;
		retry: string;
		unavailable_title: string;
		unavailable_text: string;
		expired_title: string;
		expired_text: string;
		start_over: string;
		/** Posted into the conversation while the server asks us to wait. */
		busy: string;
		/** Shown after the interview while counting down to the redirect. */
		redirecting: (seconds: number) => string;
		continue_now: string;
	};
	/** Answering by voice, in place of the message box. */
	speech: {
		discard: string;
		send: string;
		could_not_start: string;
		transcribing: string;
		/** Accessible name of the level meter. */
		recording: string;
		transcription_unavailable: string;
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
			skip_title: 'Skip this question',
			upload_image: 'Upload image',
			image_upload_failed: 'The image could not be uploaded.',
			read_aloud: 'Read questions aloud',
			stop_reading_aloud: 'Stop reading questions aloud',
			show_help: 'Show help',
			end_interview: 'End interview',
			record_audio: 'Record audio'
		},
		connection: {
			reconnecting: 'Reconnecting...',
			lost: 'Connection lost. Unable to reconnect.',
			retry: 'Retry',
			unavailable_title: 'The interview cannot continue',
			unavailable_text:
				'Something on our side is preventing the interview from running. Your answers so far have been saved. Please try again later, or contact the person who shared this interview with you.',
			expired_title: 'Your session has expired',
			expired_text:
				'We could not resume your interview — this can happen if too much time has passed or if your browser cleared its data. You cannot continue this interview from where you left off.',
			start_over: 'Start a new interview',
			busy: 'The interview service is busy. Trying again in a moment…',
			redirecting: (s) => `You will be redirected in ${s} ${s === 1 ? 'second' : 'seconds'}.`,
			continue_now: 'Continue now'
		},
		speech: {
			discard: 'Discard recording',
			send: 'Send recording',
			could_not_start: 'Could not start recording.',
			transcribing: 'Transcribing...',
			recording: 'Recording',
			transcription_unavailable: 'Transcription unavailable'
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
			skip_title: 'Spring dette spørgsmål over',
			upload_image: 'Upload billede',
			image_upload_failed: 'Billedet kunne ikke uploades.',
			read_aloud: 'Læs spørgsmål højt',
			stop_reading_aloud: 'Stop oplæsning af spørgsmål',
			show_help: 'Vis hjælp',
			end_interview: 'Afslut interview',
			record_audio: 'Optag lyd'
		},
		connection: {
			reconnecting: 'Genopretter forbindelsen...',
			lost: 'Forbindelsen blev afbrudt og kunne ikke genoprettes.',
			retry: 'Prøv igen',
			unavailable_title: 'Interviewet kan ikke fortsætte',
			unavailable_text:
				'En fejl hos os forhindrer interviewet i at køre. Dine svar indtil nu er gemt. Prøv igen senere, eller kontakt den person, der delte interviewet med dig.',
			expired_title: 'Din session er udløbet',
			expired_text:
				'Vi kunne ikke genoptage dit interview — det kan ske, hvis der er gået for lang tid, eller hvis din browser har slettet sine data. Du kan ikke fortsætte interviewet, hvor du slap.',
			start_over: 'Start et nyt interview',
			busy: 'Interviewtjenesten er optaget. Prøver igen om et øjeblik…',
			redirecting: (s) => `Du bliver sendt videre om ${s} ${s === 1 ? 'sekund' : 'sekunder'}.`,
			continue_now: 'Fortsæt nu'
		},
		speech: {
			discard: 'Kassér optagelse',
			send: 'Send optagelse',
			could_not_start: 'Optagelsen kunne ikke startes.',
			transcribing: 'Transskriberer...',
			recording: 'Optager',
			transcription_unavailable: 'Transskription ikke tilgængelig'
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
			skip_title: 'Diese Frage überspringen',
			upload_image: 'Bild hochladen',
			image_upload_failed: 'Das Bild konnte nicht hochgeladen werden.',
			read_aloud: 'Fragen vorlesen',
			stop_reading_aloud: 'Vorlesen beenden',
			show_help: 'Hilfe anzeigen',
			end_interview: 'Interview beenden',
			record_audio: 'Audio aufnehmen'
		},
		connection: {
			reconnecting: 'Verbindung wird wiederhergestellt...',
			lost: 'Verbindung unterbrochen. Sie konnte nicht wiederhergestellt werden.',
			retry: 'Erneut versuchen',
			unavailable_title: 'Das Interview kann nicht fortgesetzt werden',
			unavailable_text:
				'Ein Problem auf unserer Seite verhindert die Durchführung des Interviews. Ihre bisherigen Antworten wurden gespeichert. Bitte versuchen Sie es später erneut oder wenden Sie sich an die Person, die dieses Interview mit Ihnen geteilt hat.',
			expired_title: 'Ihre Sitzung ist abgelaufen',
			expired_text:
				'Wir konnten Ihr Interview nicht fortsetzen – das kann passieren, wenn zu viel Zeit vergangen ist oder Ihr Browser seine Daten gelöscht hat. Sie können dieses Interview nicht an der Stelle fortsetzen, an der Sie aufgehört haben.',
			start_over: 'Neues Interview starten',
			busy: 'Der Interviewdienst ist ausgelastet. Neuer Versuch in Kürze…',
			redirecting: (s) => `Sie werden in ${s} ${s === 1 ? 'Sekunde' : 'Sekunden'} weitergeleitet.`,
			continue_now: 'Jetzt fortfahren'
		},
		speech: {
			discard: 'Aufnahme verwerfen',
			send: 'Aufnahme senden',
			could_not_start: 'Die Aufnahme konnte nicht gestartet werden.',
			transcribing: 'Wird transkribiert...',
			recording: 'Aufnahme läuft',
			transcription_unavailable: 'Transkription nicht verfügbar'
		},
		survey: {
			pickValue: 'Wert auswählen',
			chooseOne: 'Wählen Sie eine Option',
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
			rateEach: 'Bewerten Sie jede Aussage',
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
			skip_title: 'Omitir esta pregunta',
			upload_image: 'Subir imagen',
			image_upload_failed: 'No se pudo subir la imagen.',
			read_aloud: 'Leer las preguntas en voz alta',
			stop_reading_aloud: 'Dejar de leer las preguntas en voz alta',
			show_help: 'Mostrar ayuda',
			end_interview: 'Finalizar la entrevista',
			record_audio: 'Grabar audio'
		},
		connection: {
			reconnecting: 'Reconectando...',
			lost: 'Se perdió la conexión. No se pudo volver a conectar.',
			retry: 'Reintentar',
			unavailable_title: 'La entrevista no puede continuar',
			unavailable_text:
				'Un problema por nuestra parte impide que la entrevista funcione. Tus respuestas hasta ahora se han guardado. Inténtalo de nuevo más tarde o ponte en contacto con la persona que compartió esta entrevista contigo.',
			expired_title: 'Tu sesión ha caducado',
			expired_text:
				'No hemos podido reanudar tu entrevista: esto puede ocurrir si ha pasado demasiado tiempo o si tu navegador ha borrado sus datos. No puedes continuar esta entrevista desde donde la dejaste.',
			start_over: 'Comenzar una nueva entrevista',
			busy: 'El servicio de entrevistas está ocupado. Se volverá a intentar en un momento…',
			redirecting: (s) => `Te redirigiremos en ${s} ${s === 1 ? 'segundo' : 'segundos'}.`,
			continue_now: 'Continuar ahora'
		},
		speech: {
			discard: 'Descartar grabación',
			send: 'Enviar grabación',
			could_not_start: 'No se pudo iniciar la grabación.',
			transcribing: 'Transcribiendo...',
			recording: 'Grabando',
			transcription_unavailable: 'Transcripción no disponible'
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
			skip_title: 'Passer cette question',
			upload_image: 'Envoyer une image',
			image_upload_failed: "L'image n'a pas pu être envoyée.",
			read_aloud: 'Lire les questions à voix haute',
			stop_reading_aloud: 'Arrêter la lecture des questions',
			show_help: "Afficher l'aide",
			end_interview: "Terminer l'entretien",
			record_audio: 'Enregistrer un message audio'
		},
		connection: {
			reconnecting: 'Reconnexion...',
			lost: 'Connexion perdue. Impossible de se reconnecter.',
			retry: 'Réessayer',
			unavailable_title: "L'entretien ne peut pas continuer",
			unavailable_text:
				"Un problème de notre côté empêche le déroulement de l'entretien. Vos réponses jusqu'à présent ont été enregistrées. Veuillez réessayer plus tard ou contacter la personne qui vous a transmis cet entretien.",
			expired_title: 'Votre session a expiré',
			expired_text:
				"Nous n'avons pas pu reprendre votre entretien — cela peut arriver si trop de temps s'est écoulé ou si votre navigateur a effacé ses données. Vous ne pouvez pas reprendre cet entretien là où vous l'avez laissé.",
			start_over: 'Commencer un nouvel entretien',
			busy: "Le service d'entretien est occupé. Nouvel essai dans un instant…",
			redirecting: (s) => `Vous allez être redirigé dans ${s} ${s === 1 ? 'seconde' : 'secondes'}.`,
			continue_now: 'Continuer maintenant'
		},
		speech: {
			discard: "Supprimer l'enregistrement",
			send: "Envoyer l'enregistrement",
			could_not_start: "Impossible de démarrer l'enregistrement.",
			transcribing: 'Transcription...',
			recording: 'Enregistrement en cours',
			transcription_unavailable: 'Transcription indisponible'
		},
		survey: {
			pickValue: 'Choisissez une valeur',
			chooseOne: 'Choisissez une option',
			enterNumber: 'Entrez un nombre',
			pickDate: 'Choisissez une date',
			pickDateTime: 'Choisissez une date et une heure',
			pickTime: 'Choisissez une heure',
			selectMultiple: 'Sélectionnez plusieurs options',
			other: 'Autre',
			pleaseSpecify: 'Veuillez préciser...',
			mustBeAtLeast: 'Doit être au moins',
			mustBeAtMost: 'Doit être au plus',
			pleaseProvideValue: 'Veuillez fournir une valeur'
		},
		grid: {
			rateEach: 'Évaluez chaque élément',
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
