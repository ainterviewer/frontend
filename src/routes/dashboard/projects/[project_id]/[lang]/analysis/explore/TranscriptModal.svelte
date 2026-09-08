<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Analysis } from '$lib/api';
	import type { EmbeddingSearchHit, TranscriptTurn } from '$lib/api/types.gen';
	import ChunkTranscript from './ChunkTranscript.svelte';
	import type { KeywordScope } from './explore';
	import { Dialog } from 'bits-ui';
	import { timeFormat } from 'd3-time-format';

	let {
		hit,
		keyword,
		keywordScope,
		onclose
	}: {
		/**
		 * The chunk the reader opened this from, or null when nothing is open.
		 *
		 * The hit rather than an interview id, because the modal is not "show me
		 * this interview" — it is "show me where this card came from", and
		 * everything that distinguishes the two is on the hit: which turns to
		 * scroll to, which to shade, and what to put in the header.
		 */
		hit: EmbeddingSearchHit | null;
		/**
		 * The keyword as the requests carry it — already known to parse, since
		 * the state only exposes a query it could read. Sent along so the
		 * transcript comes back with the same marks the card had: a reader who
		 * came here from a search is here to see the search in context, and a
		 * transcript that dropped the highlighting would make them find the words
		 * again by eye.
		 */
		keyword: string;
		keywordScope: KeywordScope;
		onclose: () => void;
	} = $props();

	const formatDate = timeFormat('%d %b %Y');

	let turns = $state<TranscriptTurn[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	/**
	 * Which request the turns on screen belong to.
	 *
	 * Requests are not guaranteed to answer in the order they were made, and the
	 * reader can close one transcript and open another before the first lands.
	 * Stamping each request and dropping any answer that is not the current one
	 * is what stops a stale interview from painting over a newer one.
	 */
	let token = 0;

	$effect(() => {
		const current = hit;
		if (!current) {
			turns = [];
			error = null;
			return;
		}

		const mine = ++token;
		loading = true;
		error = null;

		Analysis.readInterviewTranscript({
			path: { project_id: page.params.project_id ?? null, interview_id: current.interview_id },
			query: { keyword: keyword || null, keyword_scope: keywordScope }
		})
			.then(({ data, error: failed }) => {
				if (mine !== token) return;
				if (failed || !data) {
					error = 'This transcript could not be loaded.';
					turns = [];
				} else {
					turns = data.turns;
				}
			})
			.catch(() => {
				if (mine !== token) return;
				error = 'This transcript could not be loaded.';
				turns = [];
			})
			.finally(() => {
				if (mine === token) loading = false;
			});
	});

	/**
	 * The turns cut into the question groups they were said in.
	 *
	 * Runs of consecutive turns rather than a lookup keyed on the coordinates:
	 * a guide can return to a question, and grouping by key would splice two
	 * distant parts of the conversation together into one block that was never
	 * said that way.
	 */
	type Group = {
		key: number;
		section: number | null;
		mainQuestion: number | null;
		turns: TranscriptTurn[];
		/** Whether this is the group the reader arrived from. */
		here: boolean;
	};

	let groups = $derived.by((): Group[] => {
		const out: Group[] = [];
		for (const turn of turns) {
			// Normalised to null once, here: the coordinates are optional on the
			// wire, so a turn can arrive with `undefined` where another has `null`
			// and the two would start a new group between identical questions.
			const section = turn.section ?? null;
			const mainQuestion = turn.main_question ?? null;

			const last = out[out.length - 1];
			if (last && last.section === section && last.mainQuestion === mainQuestion) {
				last.turns.push(turn);
				continue;
			}
			out.push({ key: out.length, section, mainQuestion, turns: [turn], here: false });
		}

		// A MESSAGE chunk is one turn inside a group; everything else *is* the
		// group. Marked after the runs are built because either test needs the
		// whole group in hand.
		for (const group of out) {
			group.here = hit ? isHere(group) : false;
		}
		return out;
	});

	function isHere(group: Group): boolean {
		if (!hit) return false;
		if (hit.message_id) return group.turns.some((turn) => turn.id === hit.message_id);
		if (hit.section === null || hit.main_question === null) return false;
		return group.section === hit.section && group.mainQuestion === hit.main_question;
	}

	/**
	 * The first group the reader came from, which is what gets scrolled to.
	 *
	 * A MESSAGE chunk marks one group and a Q&A pair one too, but a guide that
	 * returns to a question can leave two — so the scroll goes to the first and
	 * the rest are simply marked where they are.
	 */
	let landingKey = $derived(groups.find((group) => group.here)?.key ?? null);

	let landing = $state<HTMLElement | null>(null);

	$effect(() => {
		const element = landing;
		if (!element) return;
		// After paint, or the scroll container has no scroll height yet and the
		// call lands at the top. `instant` because this is where the reader was
		// already looking — animating to it would be a journey they did not take.
		requestAnimationFrame(() => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
	});

	let interviewHref = $derived(
		hit
			? resolve(
					`/dashboard/projects/${page.params.project_id}/${page.params.lang ?? 'en'}/interviews/${hit.interview_id}`
				)
			: null
	);

	let date = $derived(
		hit?.interview_created_at ? formatDate(new Date(hit.interview_created_at)) : null
	);
</script>

<Dialog.Root
	open={hit !== null}
	onOpenChange={(open) => {
		if (!open) onclose();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-2000 bg-black/40 backdrop-blur-[1px]" />
		<!-- Nearly the whole screen. A transcript is long, and a dialog sized to
		     its content would be a second, narrower scroll inside a page that
		     already had one. Reading is the entire purpose of this thing, so it
		     gets the room. -->
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-2000 flex h-[85vh] w-[min(56rem,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 outline-none"
		>
			<div class="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-3">
				<div class="min-w-0">
					<Dialog.Title class="text-sm font-semibold text-gray-900">
						Interview transcript
					</Dialog.Title>
					<!-- The same facts the card footer carried, in the same order, so
					     the reader can tell at a glance that this is that card's
					     interview and not a neighbouring one. -->
					<p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-gray-400">
						{#if hit?.participant_pid}
							<span>{hit.participant_pid}</span>
						{/if}
						{#if hit}
							<span class="uppercase">{hit.language}</span>
						{/if}
						{#if hit?.interview_status}
							<span>{hit.interview_status}</span>
						{/if}
						{#if date}
							<span>{date}</span>
						{/if}
					</p>
				</div>
				<div class="flex shrink-0 items-center gap-3">
					<!-- Annotating and commenting live on the page, not here. The link
					     is how a reader who came to do that gets there, rather than
					     this dialog growing a second copy of the tooling. -->
					{#if interviewHref}
						<a
							href={interviewHref}
							class="text-xs font-medium text-primary hover:underline"
							title="Open the full transcript, where you can annotate and comment"
						>
							Open page <i class="fas fa-arrow-up-right-from-square text-[0.625rem]"></i>
						</a>
					{/if}
					<Dialog.Close
						class="cursor-pointer rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
						aria-label="Close transcript"
					>
						<i class="fa-solid fa-xmark"></i>
					</Dialog.Close>
				</div>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-5 py-4">
				{#if loading && turns.length === 0}
					<div class="space-y-2">
						{#each [70, 45, 80, 40, 60] as width, index (index)}
							<div
								class="h-8 animate-pulse rounded-xl bg-gray-200"
								style="width:{width}%;margin-left:{index % 2 ? 'auto' : '0'}"
							></div>
						{/each}
					</div>
				{:else if error}
					<p class="py-10 text-center text-sm text-gray-500">{error}</p>
				{:else if turns.length === 0}
					<p class="py-10 text-center text-sm text-gray-500">
						No messages are stored for this interview.
					</p>
				{:else}
					<div class="mx-auto flex max-w-3xl flex-col gap-3">
						{#each groups as group, index (group.key)}
							{#if group.section !== null && (index === 0 || groups[index - 1].section !== group.section)}
								<div class="mt-3 flex items-center gap-3 first:mt-0">
									<div class="h-px flex-1 bg-gray-200"></div>
									<span class="text-[0.625rem] font-bold tracking-widest text-gray-400 uppercase">
										Section {group.section + 1}
									</span>
									<div class="h-px flex-1 bg-gray-200"></div>
								</div>
							{/if}

							<!-- The group the reader came from, lifted off the page rather
							     than coloured: the bubbles inside already carry two colours
							     of their own for the search marks, and a third would have to
							     compete with them. A card and a label say "this is the one"
							     without touching the text. -->
							<div
								class="rounded-lg {group.here
									? 'bg-white p-3 ring-2 ring-primary/40'
									: 'px-3 py-1'}"
							>
								{#if group.key === landingKey}
									<!-- Nothing to see: the thing `scrollIntoView` is called on,
									     kept apart from the group's own box so that binding it
									     does not mean two spellings of the same wrapper. -->
									<span bind:this={landing} aria-hidden="true"></span>
								{/if}
								{#if group.here}
									<p
										class="mb-1.5 flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-wide text-primary uppercase"
									>
										<i class="fas fa-location-dot"></i>
										The chunk you came from
									</p>
								{/if}
								<ChunkTranscript turns={group.turns} compact={false} />
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
