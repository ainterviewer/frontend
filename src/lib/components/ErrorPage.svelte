<script module lang="ts">
	export interface ErrorPageProps {
		status?: number | string;
		heading?: string;
		description?: string;
		homeHref?: string;
	}
</script>

<script lang="ts">
	import Wave from './Wave.svelte';

	let {
		status = 500,
		heading = 'Something went wrong',
		description = 'We encountered an unexpected error. Please try again later.',
		homeHref = '/'
	}: ErrorPageProps = $props();
</script>

<svelte:head>
	<style>
		.ep-root {
			position: relative;
			min-height: 100vh;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			overflow: hidden;
			background: #ffffff;
			text-align: center;
			font-family:
				'Inter',
				system-ui,
				-apple-system,
				'Segoe UI',
				Roboto,
				sans-serif;
			color: #1c2826;
			padding: 1rem;
			margin: 0;
		}
		.ep-content {
			position: relative;
			z-index: 10;
			max-width: 36rem;
			padding: 0 1rem;
		}
		.ep-wave {
			width: 5rem;
			height: 5rem;
			margin: 0 auto;
		}
		.ep-status {
			font-size: clamp(5rem, 18vw, 9rem);
			line-height: 1;
			font-weight: 700;
			color: #196858;
			margin: 0.5rem 0 0;
		}
		.ep-heading {
			font-size: 1.875rem;
			line-height: 2.25rem;
			font-weight: 700;
			color: #1c2826;
			margin: 1rem 0 0;
		}
		.ep-desc {
			font-size: 1.125rem;
			line-height: 1.75rem;
			color: #4b5563;
			margin: 1rem auto 0;
			max-width: 28rem;
		}
		.ep-btn {
			display: inline-block;
			margin-top: 2rem;
			padding: 0.75rem 2rem;
			border-radius: 0.375rem;
			background: #196858;
			color: #ffffff;
			font-size: 1rem;
			font-weight: 500;
			text-decoration: none;
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
			transition: background 150ms ease;
		}
		.ep-btn:hover {
			background: color-mix(in oklab, #196858 90%, black);
		}
		.ep-btn:focus-visible {
			outline: 2px solid #196858;
			outline-offset: 2px;
		}
	</style>
</svelte:head>

<div class="ep-root">
	<div class="ep-content">
		<div class="ep-wave">
			<Wave className="ep-wave-svg" animate color="#196858" />
		</div>
		<h1 class="ep-status">{status}</h1>
		<h2 class="ep-heading">{heading}</h2>
		<p class="ep-desc">{description}</p>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a class="ep-btn" href={homeHref}>Go back home</a>
	</div>
</div>
