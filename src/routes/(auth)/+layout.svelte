<script lang="ts">
	import BackgroundWaves from '$lib/components/BackgroundWaves.svelte';

	let { children } = $props();
</script>

<div class="relative flex min-h-[calc(100vh)] overflow-hidden bg-dark">
	<BackgroundWaves opacity={1} speed={0.4} />
	<div class="z-10 m-auto size-200 content-center rounded-full bg-white p-25">
		<div class="transition-opacity duration-200">
			{@render children()}
		</div>
	</div>
</div>
