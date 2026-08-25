<script lang="ts">
	import { Command, Popover } from 'bits-ui';
	import { fly } from 'svelte/transition';

	interface FacetedColumn {
		getFacetedUniqueValues: () => Map<unknown, number>;
		getFilterValue: () => unknown;
		setFilterValue: (value: unknown) => void;
	}

	let {
		title,
		column,
		options,
		counts: serverCounts
	}: {
		title: string;
		column: FacetedColumn;
		/** Explicit choices; when omitted they are derived from the facet counts. */
		options?: { value: string; label: string }[];
		/**
		 * Counts per value, for a table that filters server-side. Such a table
		 * only ever holds one page, so the column's own facets would describe
		 * that page rather than the dataset.
		 */
		counts?: Record<string, number>;
	} = $props();

	/**
	 * Facet keys arrive as raw cell values (booleans, nulls, strings), so they are
	 * stringified here and matched the same way by the column's filter fn.
	 */
	const counts = $derived(
		serverCounts
			? new Map(Object.entries(serverCounts))
			: new Map(
					[...column.getFacetedUniqueValues()].map(([value, count]) => [
						value === null || value === undefined ? '' : String(value),
						count
					])
				)
	);

	const choices = $derived(
		options ??
			[...counts.keys()]
				.filter((key) => key !== '')
				.sort((a, b) => a.localeCompare(b))
				.map((key) => ({ value: key, label: key }))
	);

	const selected = $derived(new Set((column.getFilterValue() as string[] | undefined) ?? []));

	/**
	 * A selection the choices no longer contain is still shown, so it can be
	 * seen and undone. Server-side facets are counted against the other active
	 * filters, so a value can drop out of its own list while still selected --
	 * without this it would keep filtering the table invisibly.
	 */
	const allChoices = $derived([
		...choices,
		...[...selected]
			.filter((value) => !choices.some((choice) => choice.value === value))
			.map((value) => ({ value, label: value }))
	]);

	/** Past this many, the trigger reads as a count rather than a row of badges. */
	const BADGE_LIMIT = 2;
	const selectedChoices = $derived(allChoices.filter((c) => selected.has(c.value)));

	function toggle(value: string) {
		const current = (column.getFilterValue() as string[] | undefined) ?? [];
		const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
		// An empty selection means "no filter" rather than "match nothing".
		column.setFilterValue(next.length ? next : undefined);
	}
</script>

<Popover.Root>
	<Popover.Trigger
		class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary/30 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none {selected.size
			? 'border-primary/40 bg-primary/5 text-dark'
			: 'border-gray-300 text-gray-700'}"
	>
		<i class="fa-solid fa-filter text-xs {selected.size ? 'text-primary' : 'text-gray-400'}"></i>
		{title}
		{#if selected.size}
			<span class="h-4 w-px bg-primary/20"></span>
			<span class="flex gap-1">
				{#if selectedChoices.length > BADGE_LIMIT}
					<span class="rounded bg-secondary px-1.5 text-xs font-semibold text-on-secondary">
						{selectedChoices.length} selected
					</span>
				{:else}
					{#each selectedChoices as choice (choice.value)}
						<span class="rounded bg-secondary px-1.5 text-xs font-semibold text-on-secondary">
							{choice.label}
						</span>
					{/each}
				{/if}
			</span>
		{:else}
			<i class="fa-solid fa-chevron-down text-[10px] text-gray-400"></i>
		{/if}
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			class="z-2000 w-60 rounded-md border border-gray-200 bg-white shadow-lg outline-none"
			sideOffset={4}
			preventScroll={false}
			align="start"
			forceMount
		>
			{#snippet child({ wrapperProps, props, open })}
				{#if open}
					<div {...wrapperProps}>
						<div {...props} transition:fly={{ duration: 150, y: -5 }}>
							<Command.Root>
								<div class="flex items-center border-b border-gray-200 px-3">
									<i class="fa-solid fa-magnifying-glass text-xs text-gray-400"></i>
									<Command.Input
										class="w-full border-0 bg-transparent px-2 py-2 text-sm placeholder:text-gray-400 focus:border-0 focus:ring-0 focus:outline-none"
										placeholder={title}
									/>
								</div>
								<Command.List class="max-h-64 overflow-y-auto p-1">
									<Command.Empty class="px-2 py-4 text-center text-sm text-gray-500">
										No matches.
									</Command.Empty>
									{#each allChoices as choice (choice.value)}
										<Command.Item
											class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-gray-700 outline-none data-[selected=true]:bg-secondary/40"
											value={choice.value}
											keywords={[choice.label]}
											onSelect={() => toggle(choice.value)}
										>
											<span
												class="flex h-4 w-4 items-center justify-center rounded border {selected.has(
													choice.value
												)
													? 'border-primary bg-primary text-white'
													: 'border-gray-300'}"
											>
												{#if selected.has(choice.value)}
													<i class="fa-solid fa-check text-[10px]"></i>
												{/if}
											</span>
											<span class="flex-1">{choice.label}</span>
											<span class="text-xs text-gray-400 tabular-nums"
												>{counts.get(choice.value) ?? 0}</span
											>
										</Command.Item>
									{/each}
								</Command.List>
								{#if selected.size}
									<div class="border-t border-gray-200 p-1">
										<button
											type="button"
											class="w-full rounded-sm px-2 py-1.5 text-sm text-gray-700 hover:bg-secondary/40"
											onclick={() => column.setFilterValue(undefined)}
										>
											Clear filter
										</button>
									</div>
								{/if}
							</Command.Root>
						</div>
					</div>
				{/if}
			{/snippet}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
