<script lang="ts">
	import { Popover } from 'bits-ui';
	import { fly } from 'svelte/transition';
	import type { DateRange } from './features';

	interface RangeColumn {
		getFilterValue: () => unknown;
		setFilterValue: (value: unknown) => void;
	}

	let {
		title,
		column
	}: {
		title: string;
		column: RangeColumn;
	} = $props();

	const range = $derived((column.getFilterValue() as DateRange | undefined) ?? {});
	const active = $derived(!!range.from || !!range.to);

	/** `YYYY-MM-DD` as the date input produces it, shown the way the table shows dates. */
	function short(date: string) {
		const [year, month, day] = date.split('-');
		return `${day}/${month}/${year}`;
	}

	const label = $derived(
		range.from && range.to
			? `${short(range.from)} – ${short(range.to)}`
			: range.from
				? `From ${short(range.from)}`
				: range.to
					? `Until ${short(range.to)}`
					: ''
	);

	function set(next: DateRange) {
		// An empty range means "no filter" rather than "match nothing".
		const cleaned: DateRange = {};
		if (next.from) cleaned.from = next.from;
		if (next.to) cleaned.to = next.to;
		column.setFilterValue(cleaned.from || cleaned.to ? cleaned : undefined);
	}

	const dateInput =
		'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none';
</script>

<Popover.Root>
	<Popover.Trigger
		class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary/30 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none {active
			? 'border-primary/40 bg-primary/5 text-dark'
			: 'border-gray-300 text-gray-700'}"
	>
		<i class="fa-solid fa-calendar-days text-xs {active ? 'text-primary' : 'text-gray-400'}"></i>
		{title}
		{#if active}
			<span class="h-4 w-px bg-primary/20"></span>
			<span
				class="rounded bg-secondary px-1.5 text-xs font-semibold whitespace-nowrap text-on-secondary"
			>
				{label}
			</span>
		{:else}
			<i class="fa-solid fa-chevron-down text-[10px] text-gray-400"></i>
		{/if}
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			class="z-2000 w-64 rounded-md border border-gray-200 bg-white p-3 shadow-lg outline-none"
			sideOffset={4}
			preventScroll={false}
			align="start"
			forceMount
		>
			{#snippet child({ wrapperProps, props, open })}
				{#if open}
					<div {...wrapperProps}>
						<div {...props} transition:fly={{ duration: 150, y: -5 }}>
							<div class="flex flex-col gap-3">
								<label class="flex flex-col gap-1">
									<span class="text-xs font-semibold tracking-wide text-gray-500 uppercase"
										>From</span
									>
									<input
										type="date"
										class={dateInput}
										value={range.from ?? ''}
										max={range.to}
										onchange={(e) => set({ ...range, from: e.currentTarget.value })}
									/>
								</label>
								<label class="flex flex-col gap-1">
									<span class="text-xs font-semibold tracking-wide text-gray-500 uppercase">To</span
									>
									<input
										type="date"
										class={dateInput}
										value={range.to ?? ''}
										min={range.from}
										onchange={(e) => set({ ...range, to: e.currentTarget.value })}
									/>
								</label>
								{#if active}
									<button
										type="button"
										class="rounded-sm px-2 py-1.5 text-sm text-gray-700 hover:bg-secondary/40"
										onclick={() => column.setFilterValue(undefined)}
									>
										Clear filter
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/if}
			{/snippet}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
