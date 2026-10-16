<script lang="ts">
	import type { MessageReportPublic, ReportReason } from '$lib/api';
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { flagReason, flagSummary } from '$lib/components/reports/flags';
	import { formatDate } from '$lib/utils/datetime';

	/**
	 * What a respondent reported about this question, or what the safety check
	 * flagged in this answer, on the transcript.
	 *
	 * Read-only, and dashboard-side, so the labels are English rather than the
	 * respondent's language: the reason is stored as an enum, not as the text
	 * they were shown, and an analyst reading a Danish interview still reads
	 * the dashboard in English. The respondent's own comment is their words and
	 * is shown verbatim.
	 *
	 * The hover card is `HoverInfo` rather than a `title` attribute: a native
	 * tooltip renders the reason and the comment as one unstyled run of text,
	 * cannot separate several reports on the same question, and appears on the
	 * browser's own delay wherever it likes.
	 */

	let { reports }: { reports: MessageReportPublic[] } = $props();

	const REASON_LABELS: Record<ReportReason, string> = {
		inappropriate: 'Inappropriate',
		offensive: 'Offensive',
		irrelevant: 'Irrelevant',
		other: 'Other'
	};

	/** Amber for a judgement about the question, red where it is an accusation. */
	const REASON_CLASS: Record<ReportReason, string> = {
		offensive: 'bg-red-100 text-red-800',
		inappropriate: 'bg-orange-100 text-orange-800',
		irrelevant: 'bg-gray-100 text-gray-700',
		other: 'bg-gray-100 text-gray-700'
	};

	let safety = $derived(reports.some((report) => report.source === 'safety_check'));

	function heading(): string {
		const n = reports.length;
		if (!safety) {
			return n === 1 ? 'Reported by the respondent' : `Reported by the respondent ${n} times`;
		}
		return n === 1 ? 'Flagged by the safety check' : `Flagged ${n} times`;
	}
</script>

<HoverInfo side="left" sideOffset={8} contentClass="max-w-xs p-0" delay={80}>
	<span
		class="flex h-8 cursor-default items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-2 text-amber-700"
	>
		<i class="fa-solid {safety ? 'fa-shield-heart' : 'fa-flag'} text-xs"></i>
		{#if reports.length > 1}
			<span class="text-xs font-medium">{reports.length}</span>
		{/if}
	</span>

	{#snippet content()}
		<div class="min-w-56">
			<div
				class="flex items-center gap-2 border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-700"
			>
				<i class="fa-solid {safety ? 'fa-shield-heart' : 'fa-flag'} text-[10px] text-amber-600"></i>
				{heading()}
			</div>
			<ul class="divide-y divide-gray-100">
				{#each reports as report (report.id)}
					<li class="px-3 py-2">
						<div class="flex items-center justify-between gap-2">
							{#if report.safety}
								<span class="flex items-center gap-1.5">
									<span
										class="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800 first-letter:uppercase"
									>
										{flagReason(report)}
									</span>
									{#if report.safety.probability != null}
										<span class="text-[11px] text-gray-500 tabular-nums">
											{Math.round(report.safety.probability * 100)}%
										</span>
									{/if}
								</span>
							{:else if report.reason}
								<span
									class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold {REASON_CLASS[
										report.reason
									]}"
								>
									{REASON_LABELS[report.reason] ?? report.reason}
								</span>
							{/if}
							<span class="text-[11px] whitespace-nowrap text-gray-400">
								{formatDate(report.created_at)}
							</span>
						</div>
						{#if report.safety}
							{#if report.safety.reasoning}
								<!-- The model's words, not the respondent's: not quoted. -->
								<p class="mt-1.5 text-xs leading-snug text-gray-600">
									{report.safety.reasoning}
								</p>
							{/if}
							<p class="mt-1 text-[11px] leading-snug text-gray-500">
								{flagSummary(report.safety)}
							</p>
						{:else if report.comment}
							<!-- The respondent's own words, so quoted rather than paraphrased. -->
							<p class="mt-1.5 text-xs leading-snug text-gray-600 italic">
								&ldquo;{report.comment}&rdquo;
							</p>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/snippet}
</HoverInfo>
