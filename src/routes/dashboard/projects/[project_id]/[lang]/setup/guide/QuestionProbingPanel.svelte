<script lang="ts">
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import { probingEnabled, probingSummary } from '$lib/guide/probing';
	import type { GuideQuestion } from '$lib/guide/types';

	import AccordionPanel from './AccordionPanel.svelte';
	import FlagToggle from './FlagToggle.svelte';
	import { createListReorder } from './listReorder.svelte';
	import TextField from './TextField.svelte';

	interface Props {
		question: GuideQuestion;
		/** Whether the card shows the panel; the card decides, as it also
		 * decides whether Settings offers "Add Probing". */
		shown: boolean;
		dataTour?: string;
		expanded?: boolean;
	}

	let { question, shown, dataTour, expanded = $bindable(false) }: Props = $props();

	const probeReorder = createListReorder(() => question.probes, '[data-probe-row]');

	const enabled = $derived(probingEnabled(question));
	const summary = $derived(probingSummary(question));
	const probeCount = $derived(question.probes?.length ?? 0);
	const unusedProbes = $derived(!enabled && probeCount > 0);
</script>

{#if shown}
	<div class="w-full" data-tour={dataTour}>
		<AccordionPanel
			borderColor={unusedProbes ? 'border-l-amber-600' : 'border-l-violet-500'}
			bind:expanded
			removeTitle="Turn off probing"
			onremove={() => {
				question.max_probes_n = 0;
				question.max_probes_time = null;
				question.probes = [];
				expanded = false;
			}}
		>
			{#snippet header()}
				<div
					class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded {unusedProbes
						? 'bg-amber-50 text-amber-600'
						: 'bg-violet-50 text-violet-600'}"
				>
					<i class="fa-solid fa-comments text-lg"></i>
				</div>
				<div class="min-w-0 flex-1 text-left">
					<div class="font-medium text-gray-700">Probing</div>
					{#if unusedProbes}
						<div class="flex items-start gap-1.5 text-xs text-amber-600">
							<i class="fa-solid fa-triangle-exclamation mt-0.5"></i>
							<span>
								{probeCount === 1 ? 'The suggested probe' : `The ${probeCount} suggested probes`}
								won't be used while probing is off. Set Max Probes or Max Time, and neither to 0.
							</span>
						</div>
					{:else}
						<div class="truncate text-xs text-gray-500">
							{summary}
							{#if probeCount > 0}
								· {probeCount}
								{probeCount === 1 ? 'suggestion' : 'suggestions'}
							{/if}
						</div>
					{/if}
				</div>
			{/snippet}

			<div class="space-y-5 pr-6">
				<!-- Suggested probes -->
				<div>
					<span class="mb-2 block text-xs font-bold tracking-wider text-gray-700 uppercase">
						Suggested Follow-up Probes <HoverInfo
							iconColor="gray-500"
							text="Ideas the AInterviewer can draw on when it writes follow-up probes. Based on the conversation so far, it may use a suggestion as is, rephrase it, or ask something else entirely. The limits above cap how many probes are asked."
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
										class="flex-1 rounded border-gray-200 bg-white p-2 text-sm shadow-sm focus:border-primary focus:ring-primary/20"
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

				<!-- Probing Limits -->
				<div class="max-w-xs space-y-2">
					<span class="text-xs font-bold tracking-wider text-gray-700 uppercase">
						Probing Limits <HoverInfo
							iconColor="gray-500"
							text="After the main question is answered, the AInterviewer may ask follow-up probes. These limits decide how far it can go. With both set, probing stops at whichever limit is reached first. With neither set, no probes are asked. It can also stop sooner, if the interviewee declines to elaborate or <u>Check if exhausted</u> finds the question covered."
						/>
					</span>
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
					<p class="text-xs text-gray-500">{summary}</p>
					<FlagToggle
						label="Check if exhausted"
						info="Checks during probing if the question has been exhausted, based on the provided context."
						inactiveReason={enabled
							? undefined
							: 'no follow-up probes are asked. Set Max Probes or Max Time to enable probing.'}
						bind:checked={question.check_if_exhausted}
					/>
				</div>
			</div>
		</AccordionPanel>
	</div>
{/if}
