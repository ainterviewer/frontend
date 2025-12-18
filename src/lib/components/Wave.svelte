<script lang="ts">
	interface Props {
		className?: string;
		color?: string;
		speed?: number;
		amplitude?: number;
		frequency?: number;
		animate?: boolean;
		title?: string;
	}

	let {
		className = '',
		color = '#196858',
		speed = 1,
		amplitude = 1,
		frequency = 1,
		animate = false,
		title = ''
	}: Props = $props();

	let offset = $state(0);

	// Vertical offsets from the original favicon.svg
	// The favicon has transforms like "matrix(1,0,0,1,-5,223.5...)"
	// We'll simplify to vertical translation.
	// Sorted roughly by visual stack order or just list them.
	const lines = [550, 500, 450, 400, 350, 300, 250];

	$effect(() => {
		let frame: number;
		let lastTime = performance.now();

		const loop = (time: number) => {
			if (animate) {
				const delta = (time - lastTime) / 1000;
				lastTime = time;
				offset += delta * speed * 2; // * 2 for base speed adjustment
			}
			frame = requestAnimationFrame(loop);
		};

		frame = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(frame);
		};
	});

	function generatePath(yOffset: number, index: number) {
		// Added index parameter
		const points = [];
		const segments = 100; // Resolution of the wave
		const waveWidth = 800;

		// Original favicon curve approximation
		// It goes from x=10 to x=800 roughly.
		// We'll sweep 0 to 800.

		for (let i = 0; i <= segments; i++) {
			const x = (i / segments) * waveWidth;

			// Normalized x (0 to 1)
			const nx = x / waveWidth;

			// Envelope to taper ends (0 to 1 to 0)
			// Using sine window: sin(0..PI)
			const envelope = Math.sin(nx * Math.PI);

			// The Wave Function
			const baseFreq = 3 * Math.PI; // Approx 1.5 cycles across the width

			// Add phase shift based on index to make them out of sync
			const phaseShift = index * 0.3; // Arbitrary constant for visual delay
			const waveY = Math.sin(nx * baseFreq * frequency - offset + phaseShift);

			// Combine: envelope * wave * amplitude
			// Base amplitude approx 60 based on favicon viewbox
			const y = yOffset + waveY * envelope * 60 * amplitude;

			points.push(`${x},${y}`);
		}

		// Construct SVG path 'L' commands
		// Start with M
		if (points.length === 0) return '';
		const d =
			`M${points[0]} ` +
			points
				.slice(1)
				.map((p) => `L${p}`)
				.join(' ');
		return d;
	}
</script>

<div class={className + ' .wave-container'} {title}>
	<svg viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
		<circle class="z-0" xmlns="http://www.w3.org/2000/svg" cx="400" r="400" cy="400" fill="white" />
		<g
			class="z-10"
			stroke-width="20"
			stroke={color}
			fill="none"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			{#each lines as yPos, i (yPos)}
				<path class="z-10" d={generatePath(yPos, i)} />
			{/each}
		</g>
	</svg>
</div>

<style>
	.wave-container {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}
	svg {
		width: 100%;
		height: 100%;
		max-width: 600px;
	}
</style>
