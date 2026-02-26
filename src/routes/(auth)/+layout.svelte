<script lang="ts">
	import { backOut } from 'svelte/easing';
	import { scale } from 'svelte/transition';

	let { children } = $props();

	let mounted = $state(false);
	let animationDone = $state(false);

	$effect(() => {
		mounted = true;
	});
</script>

<div class="flex min-h-[calc(100vh)] bg-dark">
	{#if mounted}
		<div
			class="m-auto size-200 content-center rounded-full bg-white p-25"
			in:scale={{ duration: 500, easing: backOut, start: 0 }}
			onintroend={() => (animationDone = true)}
		>
			<div class:opacity-0={!animationDone} class="transition-opacity duration-200">
				{@render children()}
			</div>
		</div>
	{/if}
</div>
