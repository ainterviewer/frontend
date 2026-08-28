<script lang="ts">
	import type { CategoryCount } from '$lib/api/types.gen';
	import { LANGUAGE_COLORS, WRITE_IN_COLOR } from '$lib/config/chartColors';
	import { format } from 'd3-format';

	let {
		counts,
		total,
		languages,
		colorFor,
		hiddenValues = 0,
		hiddenCount = 0
	}: {
		counts: CategoryCount[];
		// Denominator for the shares. Not `sum(counts)`: a checkbox item counts
		// one bar per box ticked, so its bars add up to more than the number of
		// respondents, and each bar means "this share of respondents picked it".
		total: number;
		// The languages present in the cohort, in the order their colours were
		// assigned. One language means one solid bar; more than one stacks.
		languages: string[];
		colorFor: (language: string) => string;
		// The write-in tail the backend folded away, summarised under the bars.
		hiddenValues?: number;
		hiddenCount?: number;
	} = $props();

	const formatPercent = format('.0%');

	// A guide can author thirty options, and most of them can sit at zero. Past
	// this many the list stops being a chart and becomes a table, so the rest
	// goes behind a toggle.
	const COLLAPSED_ROWS = 10;

	let expanded = $state(false);
	let collapsible = $derived(counts.length > COLLAPSED_ROWS + 1);
	let stacked = $derived(languages.length > 1);

	// When collapsed, the rows kept are the largest ones -- cutting at the
	// authored order instead could hide the tallest bar and leave the card
	// showing a shape that is not the distribution. They are then put back into
	// authored order, so the ones on screen read in the order they were asked.
	let visible = $derived.by(() => {
		if (!collapsible || expanded) return counts;

		return counts
			.map((entry, index) => ({ entry, index }))
			.sort((a, b) => b.entry.count - a.entry.count || a.index - b.index)
			.slice(0, COLLAPSED_ROWS)
			.sort((a, b) => a.index - b.index)
			.map((d) => d.entry);
	});

	// A write-in is a residual, not a choice the guide offered, so it is drawn
	// in one neutral tone instead of being split by language: the interesting
	// question about it is "how many", not "who". That also keeps the language
	// hues meaning only one thing across the card.
	function segmentsFor(entry: CategoryCount) {
		if (entry.is_other || !stacked) {
			return [
				{
					key: 'all',
					count: entry.count,
					color: entry.is_other ? WRITE_IN_COLOR : (colorFor(languages[0]) ?? LANGUAGE_COLORS[0])
				}
			];
		}

		return languages
			.map((language) => ({
				key: language,
				count: entry.by_language?.[language] ?? 0,
				color: colorFor(language)
			}))
			.filter((segment) => segment.count > 0);
	}

	function tooltipFor(entry: CategoryCount) {
		if (!stacked || entry.is_other) return `${entry.label}: ${entry.count}`;
		const parts = languages
			.map((language) => [language, entry.by_language?.[language] ?? 0] as const)
			.filter(([, count]) => count > 0)
			.map(([language, count]) => `${language.toUpperCase()} ${count}`);
		return `${entry.label}: ${entry.count}${parts.length ? ` (${parts.join(' · ')})` : ''}`;
	}
</script>

<div class="flex flex-col gap-1.5">
	{#each visible as entry, i (`${entry.label}-${i}`)}
		{@const share = total > 0 ? entry.count / total : 0}
		<div class="grid grid-cols-[minmax(0,13rem)_1fr_auto] items-center gap-3">
			<div class="line-clamp-2 text-xs break-words text-gray-700" title={entry.label}>
				{entry.label}
				{#if entry.is_other}
					<span class="text-[0.625rem] text-gray-500">(write-in)</span>
				{/if}
			</div>
			<!-- The track is 100% of respondents, not the tallest bar. Scaling to
			     the tallest bar makes every question fill its card, so a 90/10
			     split and a 9/1 split draw identically and nothing can be compared
			     across cards without reading the numbers. A full bar here means
			     everyone. -->
			<div class="h-3 w-full overflow-hidden rounded-full bg-surface-200">
				<div
					class="flex h-full overflow-hidden rounded-full transition-[width] duration-500 ease-out"
					style="width: {Math.min(1, share) * 100}%"
					title={tooltipFor(entry)}
				>
					{#each segmentsFor(entry) as segment (segment.key)}
						<div
							class="h-full"
							style="width: {(segment.count / Math.max(1, entry.count)) *
								100}%; background-color: {segment.color}"
						></div>
					{/each}
				</div>
			</div>
			<div class="text-xs text-gray-500 tabular-nums">
				{entry.count}
				<span class="text-gray-400">· {formatPercent(share)}</span>
			</div>
		</div>
	{/each}
</div>

{#if collapsible || hiddenValues > 0}
	<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
		{#if collapsible}
			<button
				type="button"
				onclick={() => (expanded = !expanded)}
				class="text-xs font-medium text-primary hover:underline"
			>
				{expanded ? 'Show fewer' : `Show all ${counts.length} options`}
			</button>
		{/if}
		{#if hiddenValues > 0}
			<!-- A conversational interview can put a distinct wording on nearly
			     every respondent. The tail is stated rather than drawn: a hundred
			     one-answer bars say less than this line does. -->
			<span class="text-xs text-gray-500">
				+{hiddenValues} rarer write-in {hiddenValues === 1 ? 'value' : 'values'}
				({hiddenCount}
				{hiddenCount === 1 ? 'answer' : 'answers'})
			</span>
		{/if}
	</div>
{/if}
