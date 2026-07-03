// Text for the Help and Exit modals shown during an interview.
//
// Owned by the frontend (there is no i18n framework in this repo). Select the
// right language with `getModalText(lang, models)`; unknown languages fall back
// to English. The languages mirror those supported by SurveyItem.svelte. The
// contact email is fixed, and the underlying model name(s) are interpolated
// from `InterviewConfig.models` (the backend returns at least one).

const CONTACT_EMAIL = 'contact@ainterviewer.dk';

export interface ModalText {
	help_title: string;
	help_text: string;
	exit_title: string;
	exit_text: string;
	exit_button: string;
}

type Lang = 'EN' | 'DA' | 'DE' | 'ES' | 'FR';

// Model identifiers can be namespaced, e.g. "openrouter:google/gemma-4-26b-a4b-it".
// Respondents should only see the final segment ("gemma-4-26b-a4b-it").
function displayModel(model: string): string {
	return model.split('/').pop() ?? model;
}

function modelList(models: string[]): string {
	// Sort by display name so the pills render in a stable order — the backend
	// sources these from a set, whose iteration order is not guaranteed.
	const items = models
		.map(displayModel)
		.sort((a, b) => a.localeCompare(b))
		.map((m) => `<li><code>${m}</code></li>`)
		.join('');
	return `<ul class="model-list">${items}</ul>`;
}

// The paragraph explaining the LLM, followed by a list of the model(s) in use.
// Per language: the base explanation, then the intro sentence (with a
// singular/plural noun) that precedes the model list. The naming section is
// only added when we actually know the models, so the copy still reads
// correctly before the backend `models` field is populated.
const MODEL_SECTION: Record<
	Lang,
	{ base: string; intro: (noun: string) => string; noun: [one: string, many: string] }
> = {
	EN: {
		base: 'To conduct this interview we use a large language model that generates questions based on our instructions and the ongoing conversation. Such models also depend on the data they were originally trained on and on the specific architecture employed.',
		intro: (noun) => `For this interview we have chosen ${noun}:`,
		noun: ['the following language model', 'the following language models']
	},
	DA: {
		base: 'Til at gennemføre dette interview anvender vi en stor sprogmodel, der genererer spørgsmål på baggrund af vores instruktioner og samtalen. Sådanne modeller afhænger desuden af de data, de oprindeligt er trænet på, samt den specifikke arkitektur, der er anvendt.',
		intro: (noun) => `Til dette interview har vi valgt ${noun}:`,
		noun: ['følgende sprogmodel', 'følgende sprogmodeller']
	},
	DE: {
		base: 'Zur Durchführung dieses Interviews verwenden wir ein großes Sprachmodell, das Fragen auf Grundlage unserer Anweisungen und des laufenden Gesprächs generiert. Solche Modelle hängen zudem von den Daten ab, mit denen sie ursprünglich trainiert wurden, sowie von der konkret verwendeten Architektur.',
		intro: (noun) => `Für dieses Interview haben wir ${noun} gewählt:`,
		noun: ['das folgende Sprachmodell', 'die folgenden Sprachmodelle']
	},
	ES: {
		base: 'Para llevar a cabo esta entrevista utilizamos un gran modelo de lenguaje que genera preguntas a partir de nuestras instrucciones y de la conversación en curso. Estos modelos también dependen de los datos con los que fueron entrenados originalmente y de la arquitectura específica empleada.',
		intro: (noun) => `Para esta entrevista hemos elegido ${noun}:`,
		noun: ['el siguiente modelo de lenguaje', 'los siguientes modelos de lenguaje']
	},
	FR: {
		base: "Pour mener cet entretien, nous utilisons un grand modèle de langage qui génère des questions à partir de nos instructions et de la conversation en cours. De tels modèles dépendent également des données sur lesquelles ils ont été initialement entraînés ainsi que de l'architecture spécifique employée.",
		intro: (noun) => `Pour cet entretien, nous avons choisi ${noun} :`,
		noun: ['le modèle de langage suivant', 'les modèles de langage suivants']
	}
};

function modelSection(models: string[], lang: Lang): string {
	const { base, intro, noun } = MODEL_SECTION[lang];
	if (models.length === 0) return `<p>${base}</p>`;
	const n = models.length > 1 ? noun[1] : noun[0];
	return `<p>${base} ${intro(n)}</p>${modelList(models)}`;
}

// Per-language modal copy. `help_text` receives the model section so it can be
// slotted between the instructions and the contact paragraph.
const MODAL: Record<Lang, (modelHtml: string) => ModalText> = {
	EN: (modelHtml) => ({
		help_title: 'Help',
		help_text: [
			'<p>You answer each question by typing your response in the text box and pressing the "Send" button, or by using the keyboard shortcut shown next to it.</p>',
			'<p>If you would like to skip a question, hover your mouse over the interviewer\'s question and click the "Skip" button that appears.</p>',
			'<p>You can pause the interview and continue at a later time — your answers are saved automatically. If you want to end the interview permanently, click the exit button in the bottom left-hand corner.</p>',
			modelHtml,
			`<p>If you have any questions, corrections or concerns regarding the AI interviewer, please contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`
		].join(''),
		exit_title: 'Exit interview',
		exit_text: [
			'<p>Are you sure you want to exit the interview?</p>',
			'<p>Your answers so far have already been recorded.</p>',
			'<p>Choosing to exit the interview will disable the possibility of continuing the interview at a later time.</p>'
		].join(''),
		exit_button: 'Exit'
	}),
	DA: (modelHtml) => ({
		help_title: 'Hjælp',
		help_text: [
			'<p>Du svarer på hvert spørgsmål ved at skrive dit svar i tekstboksen og trykke på "Send"-knappen eller ved at bruge den viste tastaturgenvej.</p>',
			'<p>Hvis du ønsker at springe et spørgsmål over, holder du musen over interviewerens spørgsmål og klikker på "Skip"-knappen, der kommer frem.</p>',
			'<p>Du kan sætte interviewet på pause og fortsætte på et senere tidspunkt — dine svar gemmes automatisk. Hvis du ønsker at afslutte interviewet permanent, kan du klikke på exit-knappen i nederste venstre hjørne.</p>',
			modelHtml,
			`<p>Hvis du har spørgsmål, rettelser eller bekymringer vedrørende AI-intervieweren, bedes du kontakte os på <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`
		].join(''),
		exit_title: 'Afslut interview',
		exit_text: [
			'<p>Er du sikker på, at du vil afslutte interviewet?</p>',
			'<p>De svar du har afgivet indtil videre er allerede gemte.</p>',
			'<p>Hvis du afslutter interviewet vil det deaktivere muligheden for at fortsætte interviewet på et senere tidspunkt.</p>'
		].join(''),
		exit_button: 'Afslut'
	}),
	DE: (modelHtml) => ({
		help_title: 'Hilfe',
		help_text: [
			'<p>Sie beantworten jede Frage, indem Sie Ihre Antwort in das Textfeld eingeben und auf die Schaltfläche „Senden" klicken oder das daneben angezeigte Tastaturkürzel verwenden.</p>',
			'<p>Wenn Sie eine Frage überspringen möchten, bewegen Sie den Mauszeiger über die Frage des Interviewers und klicken Sie auf die erscheinende Schaltfläche „Überspringen".</p>',
			'<p>Sie können das Interview pausieren und zu einem späteren Zeitpunkt fortsetzen – Ihre Antworten werden automatisch gespeichert. Wenn Sie das Interview endgültig beenden möchten, klicken Sie auf die Beenden-Schaltfläche unten links.</p>',
			modelHtml,
			`<p>Wenn Sie Fragen, Korrekturen oder Bedenken bezüglich des KI-Interviewers haben, kontaktieren Sie uns bitte unter <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`
		].join(''),
		exit_title: 'Interview beenden',
		exit_text: [
			'<p>Sind Sie sicher, dass Sie das Interview beenden möchten?</p>',
			'<p>Ihre bisherigen Antworten wurden bereits gespeichert.</p>',
			'<p>Wenn Sie das Interview beenden, wird die Möglichkeit deaktiviert, das Interview zu einem späteren Zeitpunkt fortzusetzen.</p>'
		].join(''),
		exit_button: 'Beenden'
	}),
	ES: (modelHtml) => ({
		help_title: 'Ayuda',
		help_text: [
			'<p>Respondes a cada pregunta escribiendo tu respuesta en el cuadro de texto y pulsando el botón «Enviar», o utilizando el atajo de teclado que se muestra al lado.</p>',
			'<p>Si deseas omitir una pregunta, coloca el cursor sobre la pregunta del entrevistador y haz clic en el botón «Omitir» que aparece.</p>',
			'<p>Puedes pausar la entrevista y continuar más tarde: tus respuestas se guardan automáticamente. Si quieres finalizar la entrevista de forma permanente, haz clic en el botón de salida en la esquina inferior izquierda.</p>',
			modelHtml,
			`<p>Si tienes preguntas, correcciones o inquietudes sobre el entrevistador de IA, ponte en contacto con nosotros en <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`
		].join(''),
		exit_title: 'Salir de la entrevista',
		exit_text: [
			'<p>¿Seguro que quieres salir de la entrevista?</p>',
			'<p>Tus respuestas hasta ahora ya se han guardado.</p>',
			'<p>Salir de la entrevista desactivará la posibilidad de continuarla más adelante.</p>'
		].join(''),
		exit_button: 'Salir'
	}),
	FR: (modelHtml) => ({
		help_title: 'Aide',
		help_text: [
			'<p>Vous répondez à chaque question en saisissant votre réponse dans la zone de texte et en cliquant sur le bouton « Envoyer », ou en utilisant le raccourci clavier affiché à côté.</p>',
			"<p>Si vous souhaitez passer une question, survolez la question de l'intervieweur avec la souris et cliquez sur le bouton « Passer » qui apparaît.</p>",
			"<p>Vous pouvez mettre l'entretien en pause et le reprendre ultérieurement — vos réponses sont enregistrées automatiquement. Si vous souhaitez mettre fin définitivement à l'entretien, cliquez sur le bouton de sortie en bas à gauche.</p>",
			modelHtml,
			`<p>Si vous avez des questions, des corrections ou des préoccupations concernant l'intervieweur IA, veuillez nous contacter à <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`
		].join(''),
		exit_title: "Quitter l'entretien",
		exit_text: [
			"<p>Êtes-vous sûr de vouloir quitter l'entretien ?</p>",
			'<p>Vos réponses jusqu’à présent ont déjà été enregistrées.</p>',
			"<p>Quitter l'entretien désactivera la possibilité de le reprendre ultérieurement.</p>"
		].join(''),
		exit_button: 'Quitter'
	})
};

export function getModalText(lang: string | undefined, models: string[] = []): ModalText {
	// Language codes come from the backend already uppercased (EN/DA/DE/ES/FR);
	// fall back to English for anything unknown or missing.
	const l: Lang = lang && lang in MODAL ? (lang as Lang) : 'EN';
	return MODAL[l](modelSection(models, l));
}
