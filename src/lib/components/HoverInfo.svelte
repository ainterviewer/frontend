<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let {
		text = '',
		content,
		class: className = '',
		iconColor = 'gray-400',
		iconHoverColor = 'gray-600',
		asChild = false,
		children
	}: {
		text?: string;
		content?: Snippet;
		class?: string;
		iconColor?: string;
		iconHoverColor?: string;
		asChild?: boolean;
		children?: Snippet<[{ props?: Record<string, unknown> }]>;
	} = $props();

	let isDisabled = $derived(!text && !content);
</script>

<Tooltip.Provider>
	<Tooltip.Root delayDuration={300} disabled={isDisabled}>
		{#if asChild}
			<Tooltip.Trigger asChild>
				{#snippet child({ props })}
					{@render children?.({ props })}
				{/snippet}
			</Tooltip.Trigger>
		{:else}
			<Tooltip.Trigger class={className}>
				{#if children}
					{@render children({})}
				{:else}
					<i
						class={`fas fa-circle-info cursor-pointer text-${iconColor} hover:text-${iconHoverColor}`}
					></i>
				{/if}
			</Tooltip.Trigger>
		{/if}
		<Tooltip.Portal>
			<Tooltip.Content
				class="animate-in fade-in-0 zoom-in-95 z-50 max-w-xs rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 shadow-md outline-none"
				sideOffset={4}
			>
				{#if text}
					{text}
				{:else if content}
					{@render content()}
				{/if}
			</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
</Tooltip.Provider>
