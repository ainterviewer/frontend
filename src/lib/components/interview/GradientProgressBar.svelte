<script lang="ts">
	let { progress = 0 } = $props();

	let percentage = $derived(Math.round(Math.max(0, Math.min(100, progress))));
</script>

<div class="flex w-full items-center gap-3">
	<div class="relative h-3 w-full overflow-hidden rounded-full bg-gray-100">
		<!-- Background Gradient -->
		<div
			class="absolute inset-s-0 top-0 h-full w-full bg-linear-to-r from-primary to-dark opacity-90 rtl:bg-linear-to-l"
		></div>

		<!-- Cover (reveals gradient as it shrinks) -->
		<div
			class="absolute inset-e-0 top-0 h-full bg-gray-100 transition-[width] duration-700 ease-out"
			style="width: {100 - percentage}%"
		></div>
	</div>
	<div class="w-8 text-end text-[10px] font-medium text-gray-400">
		{percentage}%
	</div>
</div>
