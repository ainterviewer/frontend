<script lang="ts">
	import { Command, Popover } from 'bits-ui';
	import { fly } from 'svelte/transition';

	import { type Code, displayName } from '$lib/coding/codingTree';
	import type { CodingTreeState } from '$lib/coding/codingTreeState.svelte';

	let {
		tree,
		code,
		onMerge
	}: {
		tree: CodingTreeState;
		code: Code;
		/** The page owns merging, because it is the one that can offer the undo. */
		onMerge: (sourceId: string, targetId: string) => void;
	} = $props();

	let open = $state(false);

	/**
	 * Each candidate with the path to it, because a codebook reuses names across
	 * branches -- `Other` under three headings -- and picking the wrong one of
	 * those moves somebody's codings somewhere they did not mean.
	 */
	const targets = $derived(
		tree.mergeTargets(code.id).map((target) => ({
			code: target,
			path: tree
				.ancestorsOf(target.id)
				.toReversed()
				.map((ancestor) => displayName(ancestor.name))
				.join(' / ')
		}))
	);

	const unavailable = $derived(
		code.kind === 'group'
			? 'A group is never applied, so it has no codings to merge'
			: targets.length === 0
				? code.kind === 'score'
					? 'No other score on the same scale to merge into'
					: 'No other tag to merge into'
				: null
	);

	function pick(targetId: string) {
		open = false;
		onMerge(code.id, targetId);
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		class="w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
		disabled={unavailable !== null}
		title={unavailable ?? 'Move this code’s codings and sub-codes into another code'}
	>
		<i class="fas fa-code-merge mr-1"></i> Merge into…
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			class="z-2000 w-72 rounded-md border border-gray-200 bg-white shadow-lg outline-none"
			side="top"
			sideOffset={4}
			preventScroll={false}
			forceMount
		>
			{#snippet child({ wrapperProps, props, open })}
				{#if open}
					<div {...wrapperProps}>
						<div {...props} transition:fly={{ duration: 150, y: 5 }}>
							<Command.Root>
								<div class="flex items-center border-b border-gray-200 px-3">
									<i class="fa-solid fa-magnifying-glass text-xs text-gray-400"></i>
									<Command.Input
										class="w-full border-0 bg-transparent px-2 py-2 text-sm placeholder:text-gray-400 focus:border-0 focus:ring-0 focus:outline-none"
										placeholder="Merge into…"
									/>
								</div>
								<Command.List class="max-h-64 overflow-y-auto p-1">
									<Command.Empty class="px-2 py-4 text-center text-sm text-gray-500">
										No matches.
									</Command.Empty>
									{#each targets as target (target.code.id)}
										<Command.Item
											class="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm text-gray-700 outline-none data-[selected=true]:bg-secondary/40"
											value={target.code.id}
											keywords={[displayName(target.code.name), target.path]}
											onSelect={() => pick(target.code.id)}
										>
											<span
												class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
												style:background-color={target.code.color}
											></span>
											<span class="min-w-0 flex-1">
												<span class="block truncate">{displayName(target.code.name)}</span>
												{#if target.path}
													<span class="block truncate text-[11px] text-gray-400">{target.path}</span
													>
												{/if}
											</span>
										</Command.Item>
									{/each}
								</Command.List>
								<p class="border-t border-gray-100 px-3 py-2 text-[11px] text-gray-400">
									Its codings and sub-codes move to the code you pick, and its memo is added to that
									code’s. Its definition is dropped.
								</p>
							</Command.Root>
						</div>
					</div>
				{/if}
			{/snippet}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
