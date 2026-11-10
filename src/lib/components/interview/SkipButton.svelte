<script lang="ts">
	let {
		onSkip,
		label = 'Skip',
		title = 'Skip this question'
	}: { onSkip: () => void; label?: string; title?: string } = $props();
</script>

<button
	type="button"
	class="group flex h-8 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-500 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 hover:shadow-md"
	onclick={onSkip}
	{title}
>
	<span>{label}</span>
	<i class="fa-solid fa-chevron-right text-[10px] transition-transform group-hover:translate-x-0.5"
	></i>
</button>
