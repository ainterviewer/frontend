<script lang="ts">
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import type { GuideQuestion } from '$lib/guide/types';

	import FlagToggle from './FlagToggle.svelte';
	import { createListReorder } from './listReorder.svelte';
	import TextField from './TextField.svelte';

	interface Props {
		question: GuideQuestion;
		dataTour?: string;
		onAddImage: () => void;
		onAddSurvey: () => void;
		onAddCondition: () => void;
	}

	let { question, dataTour, onAddImage, onAddSurvey, onAddCondition }: Props = $props();

	const probeReorder = createListReorder(() => question.probes, '[data-probe-row]');

	// A cleared number input binds to null: no limit. Either limit at 0 turns
	// probing off, as the lib's `should_probe` does.
	const maxProbes = $derived(question.max_probes_n ?? null);
	const maxTime = $derived(question.max_probes_time ?? null);
	const probingEnabled = $derived(
		maxProbes !== 0 && maxTime !== 0 && (maxProbes !== null || maxTime !== null)
	);

	const unusedProbes = $derived(!probingEnabled && (question.probes?.length ?? 0) > 0);

	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

	const probingSummary = $derived.by(() => {
		if (!probingEnabled) return 'No follow-up probes are asked.';
		const count = maxProbes !== null ? `Up to ${plural(maxProbes, 'follow-up probe')}` : null;
		const time = maxTime !== null ? `${plural(maxTime, 'second')} of probing` : null;
		if (count && time) return `${count}, or ${time}, whichever runs out first.`;
		if (count) return `${count}, with no time limit.`;
		return `Follow-up probes for up to ${time}, with no cap on how many.`;
	});
</script>

<!-- Add buttons for Image/Survey/Condition -->
<div data-tour={dataTour ? 'question-extras' : undefined} class="space-y-4">
	{#if !question.image || !question.survey_item || question.conditions.length === 0}
		<div class="flex flex-wrap gap-4">
			{#if !question.image}
				<button
					class="flex items-center gap-2 rounded border border-gray-400 px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
					onclick={onAddImage}
				>
					<i class="fa-solid fa-image text-sky-600"></i> Add Image
				</button>
			{/if}
			{#if !question.survey_item}
				<button
					class="flex items-center gap-2 rounded border border-gray-400 px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
					onclick={onAddSurvey}
				>
					<i class="fa-solid fa-square-poll-horizontal text-indigo-500"></i> Add Survey Item
				</button>
			{/if}
			{#if question.conditions.length === 0}
				<button
					class="flex items-center gap-2 rounded border border-gray-400 px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
					onclick={onAddCondition}
				>
					<i class="fa-solid fa-code-branch text-amber-600"></i> Add Condition
				</button>
			{/if}
		</div>
	{/if}
</div>

<!-- Probes -->
<div data-tour={dataTour ? 'probes' : undefined}>
	<span class="mb-2 block text-xs font-bold tracking-wider text-gray-700 uppercase">
		Suggested Follow-up Probes <HoverInfo
			iconColor="gray-500"
			text="Ideas the AInterviewer can draw on when it writes follow-up probes. Based on the conversation so far, it may use a suggestion as is, rephrase it, or ask something else entirely. Only used when Max Probes or Max Time is set, and those limits cap how many probes are asked."
		/>
	</span>
	{#if question.probes}
		<div class="mb-2 space-y-2">
			{#each question.probes as probe, pIdx (pIdx)}
				<div
					data-probe-row
					class="flex items-center gap-2 transition-opacity"
					class:opacity-40={probeReorder.draggedIndex === pIdx}
					ondragover={(e) => probeReorder.dragOver(e, pIdx)}
					role="listitem"
				>
					<div
						data-reorder-handle
						class="cursor-grab rounded p-1 text-gray-600 outline-none hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-primary/40"
						title="Drag, or focus and press ↑/↓, to reorder"
						draggable="true"
						ondragstart={(e) => probeReorder.dragStart(e, pIdx)}
						ondragend={probeReorder.dragEnd}
						onkeydown={(e) => probeReorder.keydown(e, pIdx)}
						role="button"
						tabindex="0"
						aria-label="Reorder probe, use the up and down arrow keys"
					>
						<i class="fa-solid fa-grip-vertical"></i>
					</div>
					<TextField
						class="flex-1 rounded border-gray-200 p-2 text-sm shadow-sm focus:border-primary focus:ring-primary/20"
						text={probe}
						placeholder="Follow-up question if needed..."
					/>
					<button
						class="px-2 text-gray-400 hover:text-red-500"
						onclick={() => question.probes?.splice(pIdx, 1)}
						aria-label="Remove probe"
					>
						<i class="fa-solid fa-trash"></i>
					</button>
				</div>
			{/each}
		</div>
	{/if}
	<button
		class="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/5 hover:text-primary/80"
		onclick={() => {
			question.probes.push({});
		}}
	>
		<i class="fa-solid fa-plus"></i> Add Probe
	</button>
</div>

<!-- Configuration Grid -->
<div class="flex flex-col gap-8 border-t border-gray-200 pt-4 lg:flex-row lg:gap-26">
	<!-- Probing Limits -->
	<div data-tour={dataTour ? 'probing-limits' : undefined} class="w-full max-w-xs space-y-3">
		<span class="text-xs font-bold tracking-wider text-gray-700 uppercase">
			Probing Limits <HoverInfo
				iconColor="gray-500"
				text="After the main question is answered, the AInterviewer may ask follow-up probes. These limits decide how far it can go. With both set, probing stops at whichever limit is reached first. With neither set, no probes are asked. It can also stop sooner, if the interviewee declines to elaborate or <u>Check if exhausted</u> finds the question covered."
			/>
		</span>
		<div class="mt-2 space-y-2">
			<div class="flex items-center justify-between">
				<span class="flex items-center gap-2 text-sm text-gray-700">
					Max Probes
					<HoverInfo
						iconColor="gray-500"
						text="The most follow-up probes asked for this question. Set 0 for no probes. Leave empty to limit by time only."
					/>
				</span>
				<input
					type="number"
					min="0"
					placeholder="—"
					class="w-16 rounded border-gray-200 p-1 text-sm focus:border-primary focus:ring-primary/20"
					bind:value={question.max_probes_n}
				/>
			</div>
			<div class="flex items-center justify-between">
				<span class="flex items-center gap-2 text-sm text-gray-700">
					Max Time (seconds)
					<HoverInfo
						iconColor="gray-500"
						text="How long probing may go on, counted from the interviewee's answer to the main question. It is checked before each new probe, so a probe already asked is never cut off. Set 0 for no probes. Leave empty for no time limit."
					/>
				</span>
				<input
					type="number"
					min="0"
					placeholder="—"
					class="w-16 rounded border-gray-200 p-1 text-sm focus:border-primary focus:ring-primary/20"
					bind:value={question.max_probes_time}
				/>
			</div>
		</div>
		<p class="text-xs text-gray-500">{probingSummary}</p>
		{#if unusedProbes}
			<div class="flex items-start gap-1.5 text-xs text-amber-700">
				<i class="fa-solid fa-triangle-exclamation mt-0.5"></i>
				<span>
					The suggested probes above won't be used while probing is off. Set Max Probes or Max Time,
					and neither to 0.
				</span>
			</div>
		{/if}
	</div>

	<!-- Behavior Flags -->
	<div data-tour={dataTour ? 'behavior-flags' : undefined} class="space-y-3">
		<span class="text-xs font-bold tracking-wider text-gray-700 uppercase">Behavior Flags</span>
		<div class="mt-2 grid grid-cols-1 gap-x-20 gap-y-3 sm:grid-cols-[repeat(2,max-content)]">
			<FlagToggle
				label="Exclude from history"
				info="Excludes the question from the conversation history. This means that the AInterviewer doesn't have access to the information from this question when asking other questions."
				bind:checked={question.exclude_from_history}
			/>
			<FlagToggle
				label="Create transition"
				info="Reformulates the main question to include a transition from the previous question to the current."
				bind:checked={question.create_segue}
			/>
			<FlagToggle
				label="Reformulate if answered"
				info="Checks if the question has already been answered. If it has, the main question will be reformulated to take the previous answers into account."
				bind:checked={question.check_if_answered}
			/>
			<FlagToggle
				label="Check if exhausted"
				info="Checks during probing if the question has been exhausted, based on the provided context."
				inactiveReason={probingEnabled
					? undefined
					: 'no follow-up probes are asked. Set Max Probes or Max Time to enable probing.'}
				bind:checked={question.check_if_exhausted}
			/>
			<FlagToggle
				label="Can answer"
				info="Turn off to show this as a message the interviewee can't reply to, then move straight on to the next question. Use it to send several messages in a row."
				bind:checked={question.can_answer}
			/>
			<FlagToggle
				label="Can skip"
				info="If the user should be presented with a 'Skip' button when hovering the question."
				bind:checked={question.can_skip}
			/>
			<FlagToggle
				label="Shuffle question"
				info="If the order of this question should be randomly shuffled. There must be multiple questions in the same section with this toggled for it to have an effect."
				bind:checked={question.shuffle}
			/>
			<div class="hidden">
				<FlagToggle
					label="User image"
					info="If the user should be able to reply with an image."
					bind:checked={question.user_image}
				/>
			</div>
		</div>
	</div>
</div>
