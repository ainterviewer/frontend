<script lang="ts">
	import Info from '$lib/components/Info.svelte';
	import type { KeywordScope } from './explore';
	import type { KeywordProblem } from './keywordQuery';

	let {
		value = $bindable(),
		scope = $bindable(),
		problem
	}: {
		/** The query as typed, including whatever does not parse yet. */
		value: string;
		/** What a bare term means. `q:`/`a:` override it per term. */
		scope: KeywordScope;
		/**
		 * What is wrong with it, or null. Computed by the page's state rather
		 * than here, so that the thing deciding whether to send a request and the
		 * thing showing the reader why it did not are the same answer.
		 */
		problem: KeywordProblem | null;
	} = $props();

	/**
	 * The cheatsheet, as rows rather than prose.
	 *
	 * Written as data because it is a reference: somebody opens this to find one
	 * line, and a list of examples is faster to scan than a paragraph explaining
	 * the same operators. Ordered by how likely they are to be reached for.
	 */
	/**
	 * The scopes, in the order they widen. Labelled by what is being read rather
	 * than by who said it — "Answers" and "Questions" are what a researcher calls
	 * the two halves of a transcript.
	 */
	const scopes: { value: KeywordScope; label: string; hint: string }[] = [
		{ value: 'answer', label: 'Answers', hint: 'Search what respondents wrote' },
		{ value: 'both', label: 'Both', hint: 'Search answers and the questions that drew them' },
		{ value: 'question', label: 'Questions', hint: 'Search the interviewer’s questions' }
	];

	const syntax: { example: string; means: string }[] = [
		{ example: 'klima ansvar', means: 'both words' },
		{ example: 'hund OR kat', means: 'either word' },
		{ example: 'børn -skole', means: 'the first, not the second' },
		{ example: '(hund OR kat) ansvar', means: 'brackets group' },
		{ example: '"min nabo"', means: 'the exact phrase' },
		{ example: 'arbejd*', means: 'starts with — arbejde, arbejdet…' },
		{ example: '*kat*', means: 'anywhere inside a word' },
		{ example: 'q:stress a:træt', means: 'asked about stress, answered træt' },
		{ example: 'q:(stress OR pres)', means: 'a prefix carries into brackets' }
	];
</script>

<!-- Keyword is a filter, not a second search box, and it reads as one: it
     narrows the corpus in SQL and whatever query there is then ranks what
     survived. Both together is the question worth asking — "passages about X
     that literally say Y" — and neither search can answer it alone. Unlike the
     query it needs no inference server, so it stays usable when the query box
     does not. -->
<!-- The same `min-w`/`flex-1` the query form has, so the two searches divide
     the bar evenly. Equal rather than sized by view: which one leads depends on
     what is being asked, not on which view is open, and a bar that reflowed on
     the toggle would move the box under the cursor. -->
<div class="flex min-w-[18rem] flex-1 items-center gap-2">
	<!-- Relative so the message can hang below the input without the toolbar
	     growing a row the moment somebody types an opening bracket. -->
	<div class="relative flex-1">
		<i
			class="fas fa-quote-left pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[0.625rem] {problem
				? 'text-red-300'
				: 'text-gray-300'}"
		></i>
		<input
			type="search"
			bind:value
			placeholder="hund OR kat"
			aria-label="Filter to chunks whose answers match this keyword query"
			aria-invalid={problem ? 'true' : undefined}
			aria-describedby={problem ? 'keyword-problem' : undefined}
			class="w-full rounded-md border py-1.5 pr-3 pl-8 text-sm placeholder:text-gray-300 focus:ring-0 {problem
				? 'border-red-300 focus:border-red-400'
				: 'border-gray-200 focus:border-primary'}"
		/>
		{#if problem}
			<!-- Absolute, so an unbalanced bracket does not shove the whole
			     toolbar down and back up again on the next keystroke. -->
			<p
				id="keyword-problem"
				role="status"
				class="absolute top-full left-0 z-20 mt-1 w-max max-w-xs rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 shadow-sm"
			>
				{problem.message}
			</p>
		{/if}
	</div>

	<!-- Beside the box rather than in the rail: it changes what the words in the
	     box mean, so it belongs where they are typed and not behind a panel that
	     collapses. -->
	<div
		role="group"
		aria-label="Search in"
		class="flex overflow-hidden rounded-md border border-gray-200"
	>
		{#each scopes as option (option.value)}
			<button
				type="button"
				onclick={() => (scope = option.value)}
				aria-pressed={scope === option.value}
				title={option.hint}
				class="cursor-pointer px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors {scope ===
				option.value
					? 'bg-primary text-on-primary'
					: 'bg-white text-gray-500 hover:text-gray-900'}"
			>
				{option.label}
			</button>
		{/each}
	</div>

	<Info>
		<div class="space-y-3">
			<p class="text-sm text-gray-700">
				A filter, applied before anything is scored, so it narrows the corpus rather than the result
				list — it moves the map and the clusters too, not just this list. Matched against what
				respondents wrote, never against the question they were asked: a chunk restates its
				question, and a word the interviewer said is not a word anybody answered.
			</p>
			<div>
				<p class="mb-1 text-xs font-medium text-gray-900">Building a query</p>
				<table class="w-full text-xs">
					<tbody>
						{#each syntax as row (row.example)}
							<tr>
								<td class="py-0.5 pr-3 align-top font-mono whitespace-nowrap text-gray-900"
									>{row.example}</td
								>
								<td class="py-0.5 align-top text-gray-500">{row.means}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div>
				<p class="mb-1 text-xs font-medium text-gray-900">On the results</p>
				<p class="text-xs text-gray-500">
					<mark class="rounded-sm bg-yellow-300/90 px-0.5 text-gray-900">yellow</mark> is a word
					that matched.
					<mark
						class="rounded-sm bg-red-200/90 px-0.5 text-gray-900 line-through decoration-red-700/50"
						>red</mark
					>
					is one you excluded with <span class="font-mono">-</span>, showing up somewhere the search
					did not look — in a question when you are searching answers, or in another turn of the
					same Q&amp;A pair. It is not why the chunk is here.
				</p>
			</div>
			<p class="text-xs text-gray-500">
				<strong class="font-medium text-gray-900">Answers</strong> searches what respondents wrote, which
				is almost always what you want: the guide's own wording repeats across every interview, so searching
				questions finds where you asked about something rather than who talked about it.
			</p>
			<p class="text-xs text-gray-500">
				Case is ignored, and a term matches a whole word — <span class="font-mono">kat</span> finds
				“kat” but not “katalog”. Danish inflections are why
				<span class="font-mono">*</span> is worth reaching for:
				<span class="font-mono">arbejd*</span> catches arbejde, arbejdet and arbejdsplads at once.
			</p>
		</div>
	</Info>
</div>
