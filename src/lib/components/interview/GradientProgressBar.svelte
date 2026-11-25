<script lang="ts">
	let { progress = 0 } = $props();

	let percentage = $derived(Math.round(Math.max(0, Math.min(100, progress))));
</script>

<div class="flex w-full items-center gap-3">
	<div
		class="@container relative h-3 w-full overflow-hidden rounded-full bg-gray-100"
		role="progressbar"
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={percentage}
	>
		<!-- Only the filled part is drawn, so no cover's anti-aliased edge can
		     let the gradient show at the ends. Its gradient is sized to the
		     whole track (100cqi), so the colours stay put as it grows. -->
		<div
			class="absolute inset-s-0 top-0 h-full rounded-full bg-linear-to-r from-primary to-dark bg-no-repeat opacity-90 transition-[width] duration-700 ease-out rtl:bg-linear-to-l rtl:bg-right"
			style:width="{percentage}%"
			style:background-size="100cqi 100%"
		></div>
	</div>
	<div class="w-8 text-end text-[10px] font-medium text-gray-400">
		{percentage}%
	</div>
</div>
