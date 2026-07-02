// Text for the Help and Exit modals shown during an interview.
//
// Owned by the frontend (there is no i18n framework in this repo). Select the
// right language with `getModalText(lang, models)`; unknown languages fall back
// to English. The contact email is fixed, and the underlying model name(s) are
// interpolated from `InterviewConfig.models` (the backend returns at least one).

const CONTACT_EMAIL = 'contact@ainterviewer.dk';

export interface ModalText {
	help_title: string;
	help_text: string;
	exit_title: string;
	exit_text: string;
	exit_button: string;
}

type Lang = 'en' | 'da';

function resolveLang(lang: string | undefined): Lang {
	return lang?.toLowerCase().startsWith('da') ? 'da' : 'en';
}

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
// The naming section is only added when we actually know the models, so the copy
// still reads correctly before the backend `models` field is populated.
function modelSection(models: string[], lang: Lang): string {
	if (lang === 'da') {
		const base =
			'Til at gennemføre dette interview anvender vi en stor sprogmodel, der genererer spørgsmål på baggrund af vores instruktioner og samtalen. Sådanne modeller afhænger desuden af de data, de oprindeligt er trænet på, samt den specifikke arkitektur, der er anvendt.';
		if (models.length === 0) return `<p>${base}</p>`;
		const noun = models.length > 1 ? 'følgende sprogmodeller' : 'følgende sprogmodel';
		return `<p>${base} Til dette interview har vi valgt ${noun}:</p>${modelList(models)}`;
	}

	const base =
		'To conduct this interview we use a large language model that generates questions based on our instructions and the ongoing conversation. Such models also depend on the data they were originally trained on and on the specific architecture employed.';
	if (models.length === 0) return `<p>${base}</p>`;
	const noun = models.length > 1 ? 'the following language models' : 'the following language model';
	return `<p>${base} For this interview we have chosen ${noun}:</p>${modelList(models)}`;
}

export function getModalText(lang: string | undefined, models: string[] = []): ModalText {
	const l = resolveLang(lang);

	if (l === 'da') {
		return {
			help_title: 'Hjælp',
			help_text: [
				'<p>Du svarer på hvert spørgsmål ved at skrive dit svar i tekstboksen og trykke på "Send"-knappen eller ved at bruge den viste tastaturgenvej.</p>',
				'<p>Hvis du ønsker at springe et spørgsmål over, holder du musen over interviewerens spørgsmål og klikker på "Skip"-knappen, der kommer frem.</p>',
				'<p>Du kan sætte interviewet på pause og fortsætte på et senere tidspunkt — dine svar gemmes automatisk. Hvis du ønsker at afslutte interviewet permanent, kan du klikke på exit-knappen i nederste venstre hjørne.</p>',
				modelSection(models, l),
				`<p>Hvis du har spørgsmål, rettelser eller bekymringer vedrørende AI-intervieweren, bedes du kontakte os på <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`
			].join(''),
			exit_title: 'Afslut interview',
			exit_text: [
				'<p>Er du sikker på, at du vil afslutte interviewet?</p>',
				'<p>Dette kan ikke fortrydes og vil deaktivere muligheden for at fortsætte interviewet på et senere tidspunkt.</p>'
			].join(''),
			exit_button: 'Afslut'
		};
	}

	return {
		help_title: 'Help',
		help_text: [
			'<p>You answer each question by typing your response in the text box and pressing the "Send" button, or by using the keyboard shortcut shown next to it.</p>',
			'<p>If you would like to skip a question, hover your mouse over the interviewer\'s question and click the "Skip" button that appears.</p>',
			'<p>You can pause the interview and continue at a later time — your answers are saved automatically. If you want to end the interview permanently, click the exit button in the bottom left-hand corner.</p>',
			modelSection(models, l),
			`<p>If you have any questions, corrections or concerns regarding the AI interviewer, please contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`
		].join(''),
		exit_title: 'Exit interview',
		exit_text: [
			'<p>Are you sure you want to exit the interview?</p>',
			'<p>This cannot be undone and will disable the possibility of continuing the interview at a later time.</p>'
		].join(''),
		exit_button: 'Exit'
	};
}
