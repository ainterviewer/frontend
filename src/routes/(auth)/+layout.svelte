<script lang="ts">
	import BackgroundWaves from '$lib/components/BackgroundWaves.svelte';

	let { children } = $props();
</script>

<div class="relative flex h-[calc(100vh)] overflow-hidden bg-dark">
	<BackgroundWaves opacity={1} speed={0.4} />
	<div
		class="z-10 m-auto flex w-full max-w-md items-center justify-center bg-white p-6 max-md:h-[calc(100vh)] md:block md:h-[min(100vw,100vh,800px)] md:w-[min(100vw,100vh,800px)] md:max-w-none md:content-center md:rounded-full md:p-25"
	>
		<div class="transition-opacity duration-200">
			{@render children()}
		</div>
	</div>
</div>
