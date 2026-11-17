<script lang="ts">
	import BackgroundWaves from '$lib/components/BackgroundWaves.svelte';

	let { children } = $props();

	// The form sits in a circle only when its corners clear the edge: the
	// circle must be wider than the content's diagonal, plus a margin. A
	// window too short or narrow for that (or a taller form: sign-up, an
	// error message) gets a card the page can scroll instead.
	const MAX_DIAMETER = 800;
	const EDGE_MARGIN = 40;

	let innerWidth = $state(0);
	let innerHeight = $state(0);
	let contentWidth = $state(0);
	let contentHeight = $state(0);

	let measured = $derived(innerWidth > 0 && contentWidth > 0);
	let fitsCircle = $derived(
		Math.hypot(contentWidth, contentHeight) + 2 * EDGE_MARGIN <=
			Math.min(innerWidth, innerHeight, MAX_DIAMETER)
	);
	// Until hydration measures it, the `roomy` media query decides: a window
	// that holds even the tallest form (sign-up) in a circle.
	let shape = $derived(measured ? (fitsCircle ? 'circle' : 'card') : 'unmeasured');
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<!-- The circle spans the window edge to edge; a card keeps a gutter. -->
<div
	class={[
		'relative flex min-h-dvh overflow-hidden bg-dark',
		shape === 'card' && 'p-4',
		shape === 'unmeasured' && 'p-4 roomy:p-0'
	]}
>
	<BackgroundWaves opacity={1} speed={0.4} />
	<div
		class={[
			'z-10 m-auto flex items-center justify-center bg-white',
			shape === 'circle'
				? 'size-[min(100vw,100dvh,800px)] rounded-full'
				: 'w-full max-w-md rounded-2xl px-6 py-10 shadow-xl sm:px-10',
			shape === 'unmeasured' &&
				'roomy:size-[min(100vw,100dvh,800px)] roomy:max-w-none roomy:rounded-full roomy:p-0 roomy:shadow-none'
		]}
	>
		<div
			class="w-full max-w-sm transition-opacity duration-200"
			bind:clientWidth={contentWidth}
			bind:clientHeight={contentHeight}
		>
			{@render children()}
		</div>
	</div>
</div>
