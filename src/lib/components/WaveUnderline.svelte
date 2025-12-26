<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		color?: string;
		strokeWidth?: number;
		className?: string;
	}

	let {
		children,
		color = 'currentColor', // Inherit text color by default
		strokeWidth = 3,
		className = ''
	}: Props = $props();

	// Generate a static path with varying "hand-drawn" irregularity
	function generateComplexPath() {
		const points = [];
		const segments = 100;
		const width = 100; // 0-100 coordinate space

		for (let i = 0; i <= segments; i++) {
			const normalizedX = i / segments; // 0 to 1
			const x = normalizedX * width;

			// Envelope: starts at 0, goes to 1, ends at 0
			// Using sin^0.6 to make the "belly" of the envelope wider/flatter
			const envelope = Math.pow(Math.sin(normalizedX * Math.PI), 0.6);

			// Varying Wave Function: Sum of multiple sines for irregularity
			// Primary low freq + Secondary higher freq + Tertiary detail
			const wave =
				Math.sin(normalizedX * Math.PI * 5) * 1.0 +
				Math.sin(normalizedX * Math.PI * 11) * 0.4 +
				Math.sin(normalizedX * Math.PI * 23) * 0.15;

			// Amplitude scale (approx 20% of viewbox height)
			const amplitude = 2.5;
			const y = 10 + wave * amplitude * envelope;

			points.push(`${x},${y}`);
		}

		return (
			`M${points[0]} ` +
			points
				.slice(1)
				.map((p) => `L${p}`)
				.join(' ')
		);
	}

	// Generate once
	const d = generateComplexPath();
</script>

<span class="wave-underline-wrapper relative inline-block {className}">
	<span class="relative z-10">
		{#if children}
			{@render children()}
		{/if}
	</span>
	<svg
		class="pointer-events-none absolute top-10 left-0 w-full"
		style="bottom: -15%; height: 60%;"
		viewBox="0 0 100 20"
		preserveAspectRatio="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			{d}
			stroke={color}
			stroke-width={strokeWidth}
			fill="none"
			stroke-linecap="round"
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
		/>
	</svg>
</span>
