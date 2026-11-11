import 'driver.js/dist/driver.css';

import { driver } from 'driver.js';

import { addSkipOnboardingButton, tourSteps } from '$lib/onboarding';

// The steps a user who took the tour before steps had ids has seen.
const LEGACY_TOUR_STEPS = [
	'intro',
	'generate',
	'bulk-settings',
	'assistant-chat',
	'framing',
	'introduction',
	'section',
	'question',
	'question-settings',
	'question-settings-menu',
	'question-extras',
	'probes',
	'probing-limits',
	'behavior-flags',
	'ai-generated-questions',
	'ai-generated-sections',
	'outro',
	'timed-messages',
	'sync-state',
	'action-bar',
	'language',
	'export',
	'version-history',
	'try-interview',
	'publish',
	'done'
];

/**
 * Scroll a step's element out from under the sticky action bar.
 *
 * driver.js only scrolls to an element that is outside the viewport, and an
 * element under the action bar is still inside it. A control near the
 * bottom of the screen, such as the first question's ▶, would otherwise be
 * highlighted behind the bar. Scrolls instantly: this runs before driver.js
 * measures where to draw the highlight.
 */
function uncoverFromActionBar(element: Element | undefined) {
	const bar = document.querySelector('[data-action-bar]');
	if (!element || !bar || bar.contains(element)) return;
	const target = element.getBoundingClientRect();
	const covered = bar.getBoundingClientRect();
	if (
		target.bottom > covered.top &&
		target.top < covered.bottom &&
		target.right > covered.left &&
		target.left < covered.right
	) {
		element.scrollIntoView({ block: 'center' });
	}
}

/**
 * The interview guide's guided tour: the whole tour on a first visit, then
 * only the steps added since; nothing if the user opted out of all tours.
 * Steps point at `data-tour` attributes in the guide's components.
 */
export function startGuideTour() {
	const steps = tourSteps(
		'guide',
		[
			{
				id: 'intro',
				popover: {
					title: 'Interview Guide',
					description:
						'The interview guide is the heart of your interview project. Configure and tweak the different elements to match your own needs.'
				}
			},
			{
				id: 'generate',
				element: '[data-tour="generate"]',
				popover: {
					title: 'Generate Interview Guide',
					description:
						'Describe your theme and requirements, and have the AI draft an interview guide you can use as an inspiration for your interview guide.'
				}
			},
			{
				id: 'bulk-settings',
				element: '[data-tour="bulk-settings"]',
				popover: {
					title: 'Bulk Settings',
					description:
						'Change a setting once and apply it to every question at the same time. Enable just the probing limits or behavior flags you want to update — everything you leave off keeps its per-question value.'
				}
			},
			{
				id: 'assistant-chat',
				element: '[data-tour="assistant-chat"]',
				popover: {
					title: 'AI Assistant (experimental)',
					description:
						'You can also use our interactive AI assistant to iterate and develop your interview guide.'
				}
			},
			{
				id: 'framing',
				element: '[data-tour="framing"]',
				popover: {
					title: 'Framing',
					description:
						'Set the scene and provide background for your interview. This is never shown to the interviewee — it only helps the AI ask more relevant questions.'
				}
			},
			{
				id: 'introduction',
				element: '[data-tour="introduction"]',
				popover: {
					title: 'Introduction',
					description:
						'Here you write the first message the interviewees will receive in the chat. Use the message to welcome the interviewee and introduce your study. The message cannot be replied to.'
				}
			},
			{
				id: 'section',
				element: '[data-tour="section"]',
				popover: {
					title: 'Sections',
					description:
						'Organize your questions into sections. Each section has its own description, can be shuffled, and can be extended with AI-generated questions.'
				}
			},
			{
				id: 'question',
				element: '[data-tour="question"]',
				popover: {
					title: 'Questions',
					description:
						'These are the questions the AInterviewer will ask. Each question consists of a description, which is helps the AInterviewer to formulate relevant follow-up probes, and a main question, which is a primary question of interest. Drag them to reorder, and expand the settings to fine-tune how each one behaves.'
				}
			},
			{
				id: 'try-from-here',
				element: '[data-tour="try-from-here"]',
				popover: {
					title: 'Try From Here',
					description:
						'Test the interview from this question onward, without answering everything before it. The ▶ on a section starts at its first question. The introduction, consent and welcome are skipped, and earlier answers are missing: a condition or reference that depends on one is left out of the test.'
				}
			},
			{
				id: 'question-settings',
				element: '[data-tour="question-settings"]',
				popover: {
					title: 'Question Settings',
					description:
						"Open a question's settings to add follow-up probes, attach media or survey items, set probing limits, and tweak its behavior.",
					onNextClick: () => {
						// The settings menu element only renders once the settings panel is
						// open, so open it before advancing to the next step.
						if (!document.querySelector('[data-tour="question-settings-menu"]')) {
							(
								document.querySelector('[data-tour="question-settings"]') as HTMLElement | null
							)?.click();
						}
						// Wait for the slide transition (200ms) to settle so driver.js can
						// measure the element correctly.
						setTimeout(() => tour.moveNext(), 300);
					}
				}
			},
			{
				id: 'question-settings-menu',
				element: '[data-tour="question-settings-menu"]',
				popover: {
					title: 'Question Settings',
					description:
						"This panel holds all the advanced options for a single question. Let's walk through what you can configure here."
				}
			},
			{
				id: 'question-extras',
				element: '[data-tour="question-extras"]',
				popover: {
					title: 'Add Extras',
					description:
						'Enrich a question by attaching an image, adding a survey item for structured answers, or setting a condition that controls when the question is shown.'
				}
			},
			{
				id: 'probes',
				element: '[data-tour="probes"]',
				popover: {
					title: 'Follow-up Probes',
					description:
						'Add follow-up questions the AInterviewer can use to dig deeper when an answer needs more detail.'
				}
			},
			{
				id: 'probing-limits',
				element: '[data-tour="probing-limits"]',
				popover: {
					title: 'Probing Limits',
					description:
						'Keep probing in check by capping the number of follow-ups and the time spent on a single question.'
				}
			},
			{
				id: 'behavior-flags',
				element: '[data-tour="behavior-flags"]',
				popover: {
					title: 'Behavior Flags',
					description:
						'Toggle how a question behaves — exclude it from history, create a transition from the previous question, reformulate a question that was already answered, and more.',
					onNextClick: () => {
						// The settings menu element only renders once the settings panel is
						// open, so open it before advancing to the next step.
						if (document.querySelector('[data-tour="question-settings-menu"]')) {
							(
								document.querySelector('[data-tour="question-settings"]') as HTMLElement | null
							)?.click();
						}
						// Wait for the slide transition (200ms) to settle so driver.js can
						// measure the element correctly.
						setTimeout(() => tour.moveNext(), 300);
					}
				}
			},
			{
				id: 'ai-generated-questions',
				element: '[data-tour="ai-generated-questions"]',
				popover: {
					title: 'AI Generated Questions',
					description:
						"Once a section's predefined questions are done, the AInterviewer can generate extra questions on the fly. Specify how many you want, and cap the probing for each."
				}
			},
			{
				id: 'ai-generated-sections',
				element: '[data-tour="ai-generated-sections"]',
				popover: {
					title: 'AI Generated Sections',
					description:
						'After all your predefined sections are finished, the AInterviewer can spin up additional sections automatically. Set how many to allow.'
				}
			},
			{
				id: 'outro',
				element: '[data-tour="outro"]',
				popover: {
					title: 'Outro',
					description:
						'Write the closing message your interviewee sees when the interview ends. Use it to thank them and wrap things up.'
				}
			},
			{
				id: 'timed-messages',
				element: '[data-tour="timed-messages"]',
				popover: {
					title: 'Timed Messages',
					description:
						'Schedule messages to appear during the interview after a set number of seconds — handy for gentle nudges, reminders, or extra context.'
				}
			},
			{
				id: 'sync-state-v2',
				element: '[data-tour="sync-state"]',
				popover: {
					title: 'Saved as you type',
					description:
						'Your changes are saved as you make them, and the pill on the right says whether everything is. When others are editing with you, their avatars appear beside it: click one to jump to where they are.'
				}
			},
			{
				id: 'action-bar',
				element: '[data-action-bar]',
				popover: {
					title: 'Action Bar',
					description:
						'This bar stays within reach as you scroll. Each action is explained in the next steps.'
				}
			},
			{
				id: 'language-v2',
				element: '[data-tour="language"]',
				popover: {
					title: 'Language',
					description:
						'Switch between the languages your project supports, or add a new one. Every language shares the same questions and settings; switching changes only the text you edit. Mark a language as <u>in progress</u> while it is being translated: publishing leaves it out, and its missing text does not block publishing.'
				}
			},
			{
				id: 'export',
				element: '[data-tour="export"]',
				popover: {
					title: 'Export',
					description:
						'Download your interview guide as a PDF for sharing or review, or as JSON to back it up and move it between projects.'
				}
			},
			{
				id: 'version-history-v2',
				element: '[data-tour="version-history"]',
				popover: {
					title: 'Version History',
					description:
						'Shows the version respondents see now. A dot means the draft has changes they do not see yet. Open it to browse earlier versions, compare one with the draft to see what changed, and restore one.'
				},
				whatsNew: 'compare any version with the draft to see exactly what changed.'
			},
			{
				id: 'try-interview',
				element: '[data-tour="try-interview"]',
				popover: {
					title: 'Try Interview',
					description:
						'Launch a test run of the draft in a new tab to experience the interview as your interviewee would, without affecting your real data.'
				}
			},
			{
				id: 'publish',
				element: '[data-tour="publish"]',
				popover: {
					title: 'Publish',
					description:
						'Your edits stay a draft until you publish. Publishing makes the draft the version respondents see when you send them the interview: the guide along with the consent, welcome screen, agents and emails, in every language.'
				}
			},
			{
				id: 'done',
				element: '[data-tour="documentation"]',
				onHighlightStarted: () => {
					// Scroll back to the top for the final, centered step. The page
					// content scrolls inside the dashboard <main>, not the window.
					document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
				},
				popover: {
					title: "That's it for the Interview Guide!",
					description:
						"We'll let you poke around on your own now. Remember you can always consult our documentation through the question mark in the bottom of the sidebar.",
					popoverClass: 'driver-centered'
				}
			}
		],
		LEGACY_TOUR_STEPS
	);
	if (steps.length === 0) return;
	const tour = driver({
		showProgress: true,
		onPopoverRender: (popover) => addSkipOnboardingButton(popover, tour),
		// Tour-wide, so it covers every step. A step's own `onHighlightStarted`
		// replaces it rather than adding to it.
		onHighlightStarted: (element) => uncoverFromActionBar(element),
		steps
	});
	tour.drive();
}
