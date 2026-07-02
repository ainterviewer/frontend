<script lang="ts">
	import HoverInfo from '$lib/components/HoverInfo.svelte';
	import type { GuideQuestion } from './types';

	let {
		open = $bindable(),
		questionCount = 0,
		onApply
	} = $props<{
		open: boolean;
		questionCount?: number;
		onApply: (changes: Partial<GuideQuestion>) => void;
	}>();

	type FieldState = { enabled: boolean; value: number | boolean };

	// One row per bulk-editable setting. `value` is what gets written to every
	// question, but only when `enabled` is checked, so untouched fields keep their
	// per-question values.
	let fields = $state<Record<string, FieldState>>({
		max_probes_n: { enabled: false, value: 3 },
		max_probes_time: { enabled: false, value: 0 },
		exclude_from_history: { enabled: false, value: false },
		create_segue: { enabled: false, value: false },
		check_if_answered: { enabled: false, value: false },
		check_if_exhausted: { enabled: false, value: false },
		can_answer: { enabled: false, value: true },
		can_skip: { enabled: false, value: true },
		shuffle: { enabled: false, value: false }
	});

	const numberFields: { key: string; label: string; info: string }[] = [
		{ key: 'max_probes_n', label: 'Max Probes', info: 'Max number of follow-up probes per question.' },
		{
			key: 'max_probes_time',
			label: 'Max Time (seconds)',
			info: 'Max time to spend probing each question, in seconds.'
		}
	];

	const boolFields: { key: string; label: string; info: string }[] = [
		{
			key: 'exclude_from_history',
			label: 'Exclude from history',
			info: "Excludes the question from the conversation history. This means that the AInterviewer doesn't have access to the information from this question when asking other questions."
		},
		{
			key: 'create_segue',
			label: 'Create transition',
			info: 'Reformulates the main question to include a transition from the previous question to the current.'
		},
		{
			key: 'check_if_answered',
			label: 'Check if answered',
			info: 'Checks if the question has already been answered. If it has, the main question will be reformulated to take the previous answers into account.'
		},
		{
			key: 'check_if_exhausted',
			label: 'Check if exhausted',
			info: 'Checks during probing if the question has been exhausted, based on the provided context.'
		},
		{
			key: 'can_answer',
			label: 'Can answer',
			info: 'If the user can answer; use to send multiple messages in a row while not allowing the user to answer in between.'
		},
		{
			key: 'can_skip',
			label: 'Can skip',
			info: "If the user should be presented with a 'Skip' button when hovering the question."
		},
		{
			key: 'shuffle',
			label: 'Shuffle question',
			info: 'If the order of this question should be randomly shuffled. There must be multiple questions in the same section with this toggled for it to have an effect.'
		}
	];

	let enabledCount = $derived(Object.values(fields).filter((f) => f.enabled).length);

	function reset() {
		for (const f of Object.values(fields)) f.enabled = false;
	}

	function close() {
		open = false;
	}

	function handleApply() {
		if (enabledCount === 0) return;
		const changes: Record<string, number | boolean> = {};
		for (const [key, f] of Object.entries(fields)) {
			if (f.enabled) changes[key] = f.value;
		}
		onApply(changes as Partial<GuideQuestion>);
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	// Clear the enable flags each time the modal opens so a previous selection
	// isn't silently re-applied.
	$effect(() => {
		if (open) reset();
	});
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="bulk-settings-title"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			aria-label="Close modal"
			onclick={close}
			tabindex="-1"
		></button>

		<div
			class="animate-in fade-in zoom-in-95 relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 duration-150"
		>
			<!-- Header -->
			<div class="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
				<div class="flex items-start gap-3">
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
					>
						<i class="fa-solid fa-sliders"></i>
					</div>
					<div>
						<h3 id="bulk-settings-title" class="text-base font-semibold text-gray-900">
							Bulk question settings
						</h3>
						<p class="mt-1 text-sm text-gray-500">
							Enable a setting to apply it to all {questionCount} question{questionCount === 1
								? ''
								: 's'}. Settings you leave disabled keep their per-question values.
						</p>
					</div>
				</div>
				<button
					type="button"
					class="-mt-1 -mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
					onclick={close}
					aria-label="Close modal"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<!-- Body -->
			<div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-2">
				<!-- Probing Limits -->
				<div>
					<span class="mb-2 block text-xs font-bold tracking-wider text-gray-700 uppercase">
						Probing Limits
					</span>
					<div class="divide-y divide-gray-100 rounded-lg border border-gray-200">
						{#each numberFields as f (f.key)}
							<div class="flex items-center gap-3 px-3 py-2.5">
								<input
									id="bulk-{f.key}"
									type="checkbox"
									class="rounded border-gray-300 text-primary focus:ring-primary"
									bind:checked={fields[f.key].enabled}
								/>
								<label
									for="bulk-{f.key}"
									class="flex flex-1 cursor-pointer items-center gap-1 text-sm text-gray-700"
									class:text-gray-400={!fields[f.key].enabled}
								>
									{f.label}
									<HoverInfo class="ml-1" iconColor="gray-400" text={f.info} />
								</label>
								<input
									type="number"
									min="0"
									class="w-20 rounded border-gray-200 p-1 text-sm focus:border-primary focus:ring-primary/20 disabled:bg-gray-50 disabled:text-gray-400"
									disabled={!fields[f.key].enabled}
									bind:value={fields[f.key].value}
								/>
							</div>
						{/each}
					</div>
				</div>

				<!-- Behavior Flags -->
				<div>
					<span class="mb-2 block text-xs font-bold tracking-wider text-gray-700 uppercase">
						Behavior Flags
					</span>
					<div class="divide-y divide-gray-100 rounded-lg border border-gray-200">
						{#each boolFields as f (f.key)}
							<div class="flex items-center gap-3 px-3 py-2.5">
								<input
									id="bulk-{f.key}"
									type="checkbox"
									class="rounded border-gray-300 text-primary focus:ring-primary"
									bind:checked={fields[f.key].enabled}
								/>
								<label
									for="bulk-{f.key}"
									class="flex flex-1 cursor-pointer items-center gap-1 text-sm text-gray-700"
									class:text-gray-400={!fields[f.key].enabled}
								>
									{f.label}
									<HoverInfo class="ml-1" iconColor="gray-400" text={f.info} />
								</label>
								<button
									type="button"
									class="flex w-16 items-center justify-center rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-40"
									class:bg-primary={fields[f.key].value}
									class:text-white={fields[f.key].value}
									class:bg-gray-200={!fields[f.key].value}
									class:text-gray-600={!fields[f.key].value}
									disabled={!fields[f.key].enabled}
									onclick={() => (fields[f.key].value = !fields[f.key].value)}
								>
									{fields[f.key].value ? 'On' : 'Off'}
								</button>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/60 px-6 py-3">
				<span class="text-xs text-gray-400">
					{enabledCount} setting{enabledCount === 1 ? '' : 's'} selected
				</span>
				<div class="flex gap-2">
					<button
						type="button"
						class="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
						onclick={close}
					>
						Cancel
					</button>
					<button
						type="button"
						class="flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-dark disabled:cursor-not-allowed disabled:opacity-50"
						onclick={handleApply}
						disabled={enabledCount === 0 || questionCount === 0}
					>
						<i class="fa-solid fa-check"></i>
						Apply to all
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
