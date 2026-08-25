<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { fly } from 'svelte/transition';

	type SortDirection = 'asc' | 'desc';

	/**
	 * Structural subset of the TanStack `Column` API this header needs. Declaring
	 * it structurally keeps the component free of the table's feature generics,
	 * which gate the real `Column` type per registered feature.
	 */
	interface HeaderColumn {
		getCanSort: () => boolean;
		getIsSorted: () => false | SortDirection;
		toggleSorting: (desc?: boolean) => void;
		clearSorting: () => void;
		getCanHide: () => boolean;
		toggleVisibility: (value?: boolean) => void;
	}

	let {
		label,
		column,
		align = 'left',
		colspan = 1,
		rowspan = 1,
		top = 0,
		class: className = ''
	}: {
		label: string;
		column: HeaderColumn;
		align?: 'left' | 'right';
		colspan?: number;
		rowspan?: number;
		/** Offset this header sticks at, so stacked header rows do not overlap. */
		top?: number;
		class?: string;
	} = $props();

	const sorted = $derived(column.getIsSorted());
	const canSort = $derived(column.getCanSort());
	const canHide = $derived(column.getCanHide());

	const menuItem =
		'flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-gray-700 outline-none data-[highlighted]:bg-secondary/40';
</script>

<th
	colspan={colspan > 1 ? colspan : undefined}
	rowspan={rowspan > 1 ? rowspan : undefined}
	style="top: {top}px"
	class="p-0 font-semibold text-dark {className}"
	aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
>
	{#if !canSort && !canHide}
		<div class="px-4 py-3 {align === 'right' ? 'text-right' : ''}">{label}</div>
	{:else}
		<div class="group/header flex items-stretch">
			<!-- Click-to-sort stays on the label, matching the previous table. The
			     menu adds explicit direction, reset and hide actions. -->
			<button
				type="button"
				class="flex flex-1 items-center gap-1.5 px-4 py-3 text-left whitespace-nowrap hover:bg-dark/5 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent {align ===
				'right'
					? 'justify-end'
					: ''}"
				disabled={!canSort}
				onclick={() => column.toggleSorting()}
			>
				{label}
				{#if canSort}
					<!-- Only the sorted column shows a persistent arrow; the rest hint on
					     hover, so seven columns don't compete for attention. -->
					{#if sorted}
						<i class="fa-solid fa-arrow-{sorted === 'asc' ? 'up' : 'down'}-long text-[11px]"></i>
					{:else}
						<i
							class="fa-solid fa-arrow-down-long text-[11px] text-dark/30 opacity-0 group-hover/header:opacity-100"
						></i>
					{/if}
				{/if}
			</button>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger
					class="px-2 text-dark/40 opacity-0 group-hover/header:bg-dark/5 group-hover/header:text-dark/70 group-hover/header:opacity-100 hover:bg-dark/15 hover:text-dark focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none data-[state=open]:bg-dark/15 data-[state=open]:text-dark data-[state=open]:opacity-100"
					aria-label="{label} column options"
				>
					<i class="fa-solid fa-ellipsis-vertical text-xs"></i>
				</DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content
						class="z-2000 min-w-[11rem] rounded-md border border-gray-200 bg-white p-1 text-sm font-normal tracking-normal normal-case shadow-lg outline-none"
						sideOffset={4}
						preventScroll={false}
						align="start"
						forceMount
					>
						{#snippet child({ wrapperProps, props, open })}
							{#if open}
								<div {...wrapperProps}>
									<div {...props} transition:fly={{ duration: 150, y: -5 }}>
										{#if canSort}
											<DropdownMenu.Item
												class={menuItem}
												onSelect={() => column.toggleSorting(false)}
											>
												<i class="fa-solid fa-arrow-up-long w-3.5 text-gray-400"></i>
												Sort ascending
											</DropdownMenu.Item>
											<DropdownMenu.Item
												class={menuItem}
												onSelect={() => column.toggleSorting(true)}
											>
												<i class="fa-solid fa-arrow-down-long w-3.5 text-gray-400"></i>
												Sort descending
											</DropdownMenu.Item>
											{#if sorted}
												<DropdownMenu.Item class={menuItem} onSelect={() => column.clearSorting()}>
													<i class="fa-solid fa-xmark w-3.5 text-gray-400"></i>
													Clear sort
												</DropdownMenu.Item>
											{/if}
										{/if}
										{#if canSort && canHide}
											<DropdownMenu.Separator class="my-1 h-px bg-gray-200" />
										{/if}
										{#if canHide}
											<DropdownMenu.Item
												class={menuItem}
												onSelect={() => column.toggleVisibility(false)}
											>
												<i class="fa-solid fa-eye-slash w-3.5 text-gray-400"></i>
												Hide column
											</DropdownMenu.Item>
										{/if}
									</div>
								</div>
							{/if}
						{/snippet}
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		</div>
	{/if}
</th>
