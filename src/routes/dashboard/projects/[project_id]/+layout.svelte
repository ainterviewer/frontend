<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { projectSidebarItems } from '$lib/config/sidebar';
	import { SIDEBAR_STAGE, startTourOnce } from '$lib/tour';
	import { onMount } from 'svelte';

	let { children } = $props();

	function startOnboarding() {
		return startTourOnce('project', {
			// Every step but the last is a sidebar item.
			...SIDEBAR_STAGE,
			steps: [
				{
					element: '[data-tour="setup"]',
					popover: {
						title: 'Setup',
						description:
							'The setup includes creating a <u>consent</u> and <u>welcome</u> message, and create your <u>interview guide</u>.'
					}
				},
				{
					element: '[data-tour="agents"]',
					popover: {
						title: 'Agents',
						description:
							'In the <u>agents</u> tab, you can modify the AI agent(s) configuration and behavior.'
					}
				},
				{
					element: '[data-tour="pilot-interviews"]',
					popover: {
						title: 'Pilot Interviews',
						description:
							'In <u>pilot interviews</u> you can configure and run simulations, as well as read through test interviews.'
					}
				},
				{
					element: '[data-tour="distribute"]',
					popover: {
						title: 'Distribute',
						description:
							'The <u>distribute</u> tab lets you share your interview with respondents, either via a URL or a QR code. You can also <u>monitor</u> your ongoing data collection.'
					}
				},
				{
					element: '[data-tour="interview-data"]',
					popover: {
						title: 'Interview Data',
						description:
							'A table of your collected <u>interview data</u>, with the ability to view or export them.'
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
					element: '[data-tour="settings"]',
					popover: {
						title: 'Settings',
						description: 'Change the title, default language and status of your project.'
					}
				},
				{
					element: '[data-tour="documentation"]',
					// Give the small documentation icon some breathing room.
					data: { stagePadding: 8, stageRadius: 5 },
					popover: {
						title: "That's it for the Project Sidebar!",
						description:
							"We'll let you poke around now on your own. Remember you can always consult our documentation through the question mark in the bottom of the sidebar.",
						popoverClass: 'driver-centered'
					}
				}
			]
		});
	}

	// Returning the cleanup closes the tour when leaving the project.
	onMount(startOnboarding);
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
