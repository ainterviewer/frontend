<script lang="ts">
	import { Select } from 'bits-ui';
	import { fly } from 'svelte/transition';

	type Item = { value: string; label: string; disabled?: boolean };

	let {
		value = $bindable(),
		items,
		placeholder = 'Select an option',
		class: className = '',
		disabled = false,
		...restProps
	}: {
		value: string;
		items: Item[];
		placeholder?: string;
		class?: string;
		disabled?: boolean;
		[key: string]: unknown;
	} = $props();

	const selectedLabel = $derived(items.find((i) => i.value === value)?.label || placeholder);
</script>

<Select.Root type="single" bind:value {items} {disabled} {...restProps}>
	<Select.Trigger
		class="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 {className}"
	>
		<span class="truncate">{selectedLabel}</span>
		<i class="fa-solid fa-chevron-down text-gray-500"></i>
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			class="z-[2000] min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white text-gray-950 shadow-md focus:outline-none"
			sideOffset={4}
			preventScroll={false}
			forceMount
		>
			{#snippet child({ wrapperProps, props, open })}
				{#if open}
					<div {...wrapperProps}>
						<div {...props} transition:fly={{ duration: 150, y: -5 }}>
							<Select.Viewport class="p-1">
								{#each items as item (item.value)}
									<Select.Item
										class="relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-gray-100"
										value={item.value}
										label={item.label}
										disabled={item.disabled}
									>
										{#snippet children({ selected })}
											{#if selected}
												<span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
													<i class="fa-solid fa-check text-xs"></i>
												</span>
											{/if}
											<span>{item.label}</span>
										{/snippet}
									</Select.Item>
								{/each}
							</Select.Viewport>
						</div>
					</div>
				{/if}
			{/snippet}
		</Select.Content>
	</Select.Portal>
</Select.Root>
