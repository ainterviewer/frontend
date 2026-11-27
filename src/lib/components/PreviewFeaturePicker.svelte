<script lang="ts">
	import { Popover } from 'bits-ui';
	import { fly } from 'svelte/transition';

	import type { PreviewFeature } from '$lib/api/types.gen';
	import { PREVIEW_FEATURES } from '$lib/preview';

	let {
		value = $bindable([]),
		id,
		triggerClass = 'mt-1 w-full rounded border border-gray-300 p-2 text-sm'
	}: {
		value?: PreviewFeature[];
		/** For a `<label for>` beside it: the trigger is a button, which labels can name. */
		id?: string;
		/** Sizing and border of the trigger, to match the form's other inputs. */
		triggerClass?: string;
	} = $props();

	/** Past this many, the trigger reads as a count rather than a list of names. */
	const NAME_LIMIT = 2;

	const selected = $derived(PREVIEW_FEATURES.filter((f) => value.includes(f.value)));
	const summary = $derived(
		selected.length === 0
			? 'None'
			: selected.length === PREVIEW_FEATURES.length
				? 'All features'
				: selected.length > NAME_LIMIT
					? `${selected.length} of ${PREVIEW_FEATURES.length} features`
					: selected.map((f) => f.label).join(', ')
	);

	function toggle(feature: PreviewFeature) {
		value = value.includes(feature) ? value.filter((f) => f !== feature) : [...value, feature];
	}
</script>

<Popover.Root>
	<Popover.Trigger
		{id}
		type="button"
		class="flex items-center justify-between gap-2 bg-white text-left focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none {triggerClass}"
		title={selected.map((f) => f.label).join(', ') || undefined}
		onclick={(e: MouseEvent) => e.stopPropagation()}
	>
		<span class="truncate {selected.length ? 'text-gray-900' : 'text-gray-400'}">{summary}</span>
		<i class="fa-solid fa-chevron-down text-[10px] text-gray-500"></i>
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			class="z-2000 w-(--bits-popover-anchor-width) min-w-60 rounded-md border border-gray-200 bg-white shadow-lg outline-none"
			sideOffset={4}
			preventScroll={false}
			align="start"
			forceMount
		>
			{#snippet child({ wrapperProps, props, open })}
				{#if open}
					<div {...wrapperProps}>
						<div {...props} transition:fly={{ duration: 150, y: -5 }}>
							<ul class="m-0 list-none p-1">
								{#each PREVIEW_FEATURES as feature (feature.value)}
									<li>
										<label
											class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-gray-700 hover:bg-secondary/40"
										>
											<input
												type="checkbox"
												class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
												checked={value.includes(feature.value)}
												onchange={() => toggle(feature.value)}
											/>
											{feature.label}
										</label>
									</li>
								{/each}
							</ul>
							<div class="flex border-t border-gray-200 p-1 text-sm">
								<button
									type="button"
									class="flex-1 rounded-sm px-2 py-1.5 text-gray-700 hover:bg-primary hover:text-white disabled:text-gray-300 disabled:hover:bg-transparent"
									disabled={selected.length === PREVIEW_FEATURES.length}
									onclick={() => (value = PREVIEW_FEATURES.map((f) => f.value))}
								>
									Select all
								</button>
								<button
									type="button"
									class="flex-1 rounded-sm px-2 py-1.5 text-gray-700 hover:bg-primary hover:text-white disabled:text-gray-300 disabled:hover:bg-transparent"
									disabled={selected.length === 0}
									onclick={() => (value = [])}
								>
									Clear
								</button>
							</div>
						</div>
					</div>
				{/if}
			{/snippet}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
