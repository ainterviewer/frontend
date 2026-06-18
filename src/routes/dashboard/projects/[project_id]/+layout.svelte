<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { projectSidebarItems } from '$lib/config/sidebar';
	import { driver } from 'driver.js';
	import 'driver.js/dist/driver.css';
	import { onMount } from 'svelte';

	let { children } = $props();

	function startOnboarding() {
		const tour = driver({
			showProgress: true,
			stagePadding: 0,
			stageRadius: 0,
			// stagePadding/stageRadius are global, so give only the last step (the
			// small documentation icon) some breathing room around its highlight.
			onHighlightStarted: (_element, _step, { driver }) => {
				const last = driver.isLastStep();
				driver.setConfig({
					...driver.getConfig(),
					stagePadding: last ? 8 : 0,
					stageRadius: last ? 5 : 0
				});
			},
			steps: [
				{
					element: '[data-tour="setup"]',
					popover: {
						title: 'Setup',
						description:
							'The setup includes creating a <u>consent</u> and <u>welcome</u> message, and filling out the <u>interview guide</u>.'
					}
				},
				{
					element: '[data-tour="agents"]',
					popover: {
						title: 'Agents',
						description: 'In the agents tab, you can modify the AI agent(s) behavior.'
					}
				},
				{
					element: '[data-tour="pilot-interviews"]',
					popover: {
						title: 'Pilot Interviews',
						description:
							'Pilot Interviews includes the possability to configure and run simulations, and read through test interviews.'
					}
				},
				{
					element: '[data-tour="distribute"]',
					popover: {
						title: 'distribute',
						description:
							'The distribute tab lets you share your interview with respondents, either via a URL or a QR code. You can also <u>monitor</u> your ongoing data collection.'
					}
				},
				{
					element: '[data-tour="interview-data"]',
					popover: {
						title: 'Interview Data',
						description:
							'A table of your collected interview data, with the ability to view or export them.'
					}
				},
				{
					element: '[data-tour="analysis"]',
					popover: {
						title: 'Analysis',
						description: 'Analyse your interviews through tags and scores.'
					}
				},
				{
					element: '[data-tour="settings"]',
					popover: {
						title: 'Settings',
						description: 'Change the title, default language and status of your project.'
					}
				},
				{
					element: '[data-tour="documentation"]',
					popover: {
						title: "That's it project sidebar!",
						description:
							"We'll let you poke around now on your own. Remember you can always consult our documentation through the question mark in the bottom of the sidebar.",
						popoverClass: 'driver-centered'
					}
				}
			]
		});
		tour.drive();
	}

	onMount(() => {
		// Show the onboarding tour once per user.
		// if (!localStorage.getItem('project-onboarded')) {
		startOnboarding();
		// 	localStorage.setItem('project-onboarded', 'true');
		// }
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
