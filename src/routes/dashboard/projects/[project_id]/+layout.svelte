<script lang="ts">
	import 'driver.js/dist/driver.css';

	import { driver } from 'driver.js';
	import { onMount } from 'svelte';

	import { page } from '$app/state';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { projectSidebarItems } from '$lib/config/sidebar';
	import { addSkipOnboardingButton, tourSteps } from '$lib/onboarding';

	let { children } = $props();

	// The steps a user who took the tour before steps had ids has seen.
	const LEGACY_TOUR_STEPS = [
		'setup',
		'agents',
		'pilot-interviews',
		'distribute',
		'interview-data',
		'settings',
		'done'
	];
	const DOCUMENTATION = '[data-tour="documentation"]';

	function startOnboarding() {
		// The safety check is a preview feature; only mention it to those who have it.
		const safetyCheck = !!page.data.user?.with_preview_features;
		const steps = tourSteps(
			'project',
			[
				{
					id: 'setup-v2',
					element: '[data-tour="setup"]',
					popover: {
						title: 'Setup',
						description:
							'The setup includes creating a <u>consent</u> and <u>welcome</u> message, and create your <u>interview guide</u>. Your collaborators can edit them with you at the same time, and see your changes as you type.'
					}
				},
				{
					id: 'agents-v2',
					element: '[data-tour="agents"]',
					popover: {
						title: 'Agents',
						description: `In the <u>agents</u> tab, you can modify the AI agent(s) configuration and behavior.${
							safetyCheck
								? ' You can also set up a <u>safety check</u> that reads every answer and shows the respondent a message when one of your rules applies.'
								: ''
						} Changes are saved as you make them.`
					}
				},
				{
					id: 'pilot-interviews',
					element: '[data-tour="pilot-interviews"]',
					popover: {
						title: 'Pilot Interviews',
						description:
							'In <u>pilot interviews</u> you can configure and run simulations, as well as read through test interviews.'
					}
				},
				{
					id: 'distribute',
					element: '[data-tour="distribute"]',
					popover: {
						title: 'Distribute',
						description:
							'The <u>distribute</u> tab lets you share your interview with respondents, either via a URL or a QR code. You can also <u>monitor</u> your ongoing data collection.'
					}
				},
				{
					id: 'interview-data-v2',
					element: '[data-tour="interview-data"]',
					popover: {
						title: 'Interview Data',
						description: `A table of your collected <u>interview data</u>, with the ability to view or export them. Interviews with messages respondents reported${
							safetyCheck ? ' or the safety check acted on' : ''
						} are marked with a flag, and you can filter by it.`
					}
				},
				// {
				// 	element: '[data-tour="analysis"]',
				// 	popover: {
				// 		title: 'Analysis',
				// 		description: 'Analyse your interviews through tags and scores.'
				// 	}
				// },
				{
					id: 'settings',
					element: '[data-tour="settings"]',
					popover: {
						title: 'Settings',
						description: 'Change the title, default language and status of your project.'
					}
				},
				{
					id: 'done',
					element: DOCUMENTATION,
					popover: {
						title: "That's it for the Project Sidebar!",
						description:
							"We'll let you poke around now on your own. Remember you can always consult our documentation through the question mark in the bottom of the sidebar.",
						popoverClass: 'driver-centered'
					}
				}
			],
			LEGACY_TOUR_STEPS
		);
		if (steps.length === 0) return;
		const tour = driver({
			showProgress: true,
			stagePadding: 0,
			stageRadius: 0,
			onPopoverRender: (popover) => addSkipOnboardingButton(popover, tour),
			// stagePadding/stageRadius are global, so give only the closing step
			// (the small documentation icon) some breathing room around its highlight.
			onHighlightStarted: (_element, step, { driver }) => {
				const last = step.element === DOCUMENTATION;
				driver.setConfig({
					...driver.getConfig(),
					stagePadding: last ? 8 : 0,
					stageRadius: last ? 5 : 0
				});
			},
			steps
		});
		tour.drive();
	}

	onMount(() => {
		// The whole tour on a first visit, then only steps added since; nothing
		// if the user opted out of all tours.
		startOnboarding();
	});
</script>

<Sidebar items={projectSidebarItems} />
{@render children()}

<style>
	:global(.driver-popover.driver-centered) {
		top: 50% !important;
		left: 50% !important;
		right: auto !important;
		bottom: auto !important;
		transform: translate(-50%, -50%) !important;
	}
	:global(.driver-popover.driver-centered .driver-popover-arrow) {
		display: none !important;
	}
</style>
