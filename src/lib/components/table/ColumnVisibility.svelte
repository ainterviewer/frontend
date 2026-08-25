<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { fly } from 'svelte/transition';

	interface ToggleableColumn {
		id: string;
		getCanHide: () => boolean;
		getIsVisible: () => boolean;
		toggleVisibility: (value?: boolean) => void;
	}

	let { columns, labels }: { columns: ToggleableColumn[]; labels: Record<string, string> } =
		$props();

	const hideable = $derived(columns.filter((c) => c.getCanHide()));
	const hiddenCount = $derived(hideable.filter((c) => !c.getIsVisible()).length);
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-secondary/30 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
	>
		<i class="fa-solid fa-table-columns text-xs text-gray-400"></i>
		Columns
		{#if hiddenCount > 0}
			<span class="rounded bg-secondary px-1.5 text-xs font-semibold text-on-secondary">
				{hiddenCount} hidden
			</span>
		{/if}
		<i class="fa-solid fa-chevron-down text-[10px] text-gray-400"></i>
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			class="z-2000 min-w-[14rem] rounded-md border border-gray-200 bg-white shadow-lg outline-none"
			sideOffset={4}
			preventScroll={false}
			align="end"
			forceMount
		>
			{#snippet child({ wrapperProps, props, open })}
				{#if open}
					<div {...wrapperProps}>
						<div {...props} transition:fly={{ duration: 150, y: -5 }}>
							<p
								class="border-b border-gray-200 px-3 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase"
							>
								Show columns
							</p>
							<div class="p-1">
								{#each hideable as column (column.id)}
									<DropdownMenu.CheckboxItem
										class="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm text-gray-700 outline-none data-[highlighted]:bg-secondary/40"
										checked={column.getIsVisible()}
										closeOnSelect={false}
										onCheckedChange={(checked) => column.toggleVisibility(checked)}
									>
										{#snippet children({ checked })}
											<span
												class="flex h-4 w-4 shrink-0 items-center justify-center rounded border {checked
													? 'border-primary bg-primary text-white'
													: 'border-gray-300'}"
											>
												{#if checked}
													<i class="fa-solid fa-check text-[10px]"></i>
												{/if}
											</span>
											{labels[column.id] ?? column.id}
										{/snippet}
									</DropdownMenu.CheckboxItem>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			{/snippet}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
