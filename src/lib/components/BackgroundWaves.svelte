<script lang="ts">
	interface Props {
		color?: string;
		count?: number;
		opacity?: number;
		speed?: number;
	}

	let { color = 'white', count = 7, opacity = 0.1, speed = 0.5 }: Props = $props();

	let offset = $state(0);

	$effect(() => {
		let frame: number;
		let lastTime = performance.now();

		const loop = (time: number) => {
			const delta = (time - lastTime) / 1000;
			lastTime = time;
			offset += delta * speed;
			frame = requestAnimationFrame(loop);
		};

		frame = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(frame);
		};
	});

	function generatePath(yOffset: number, index: number) {
		const points = [];
		const segments = 100;
		const width = 1000;

		for (let i = 0; i <= segments; i++) {
			const x = (i / segments) * width;
			const nx = x / width;

			// Lower frequency (approx 1-1.5 cycles) for "wider" waves
			const freq = 1 * Math.PI * (1 + index * 0.05);
			const phaseShift = index * 0.8;
			const waveY = Math.sin(nx * freq - offset + phaseShift);

			// Envelope to fade out at edges
			const envelope = Math.sin(nx * Math.PI);

			const y = yOffset + waveY * 40 * envelope;
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

	// Centering the offsets around 500 in a 1000-unit viewbox
	const lineOffsets = $derived(
		Array.from({ length: count }, (_, i) => {
			const totalHeight = (count - 1) * 80;
			const startY = 500 - totalHeight / 2;
			return startY + i * 80;
		})
	);
</script>

<div class="pointer-events-none absolute inset-0 overflow-hidden" style="opacity: {opacity}">
	<svg
		viewBox="0 0 1000 1000"
		preserveAspectRatio="none"
		class="h-full w-full"
		xmlns="http://www.w3.org/2000/svg"
	>
		<g fill="none" stroke={color} stroke-width="6" stroke-linecap="round">
			{#each lineOffsets as yPos, i (i)}
				<path d={generatePath(yPos, i)} />
			{/each}
		</g>
	</svg>
</div>
