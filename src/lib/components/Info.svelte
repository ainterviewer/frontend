<script lang="ts">
	import { Popover } from 'bits-ui';

	let { text = '', class: className = '', children } = $props();
</script>

<Popover.Root>
	<Popover.Trigger class={className}>
		<i class="fas fa-circle-info cursor-pointer text-gray-400 hover:text-gray-600"></i>
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-2000 w-100 rounded-md border border-gray-200 bg-white p-4 shadow-md outline-none"
			sideOffset={8}
		>
			{#if text}
				<p class="text-sm text-gray-700">{text}</p>
			{:else if children}
				{@render children()}
			{/if}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
