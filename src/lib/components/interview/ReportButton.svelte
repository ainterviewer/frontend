<script lang="ts">
	/**
	 * The flag beside an interviewer question that opens the report dialog.
	 *
	 * Sits in `InterviewMessage`'s hover controls next to `SkipButton`, and is
	 * styled as the quieter of the two: reporting a question is the rarer act,
	 * and a button competing with "Skip" for attention would invite reports
	 * from respondents who only meant to move on.
	 */

	let { onReport, label }: { onReport: () => void; label: string } = $props();
</script>

<button
	type="button"
	class="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-gray-300 transition-all hover:border-gray-200 hover:bg-white hover:text-gray-600 hover:shadow-sm"
	onclick={onReport}
	title={label}
	aria-label={label}
>
	<i class="fa-solid fa-flag text-xs"></i>
</button>
