<script lang="ts">
	import HoverInfo from '$lib/components/HoverInfo.svelte';

	interface Props {
		label: string;
		/** What the flag does, shown on hover. HTML. */
		info: string;
		checked: boolean | null | undefined;
		/** Why the flag has no effect right now. Set, it greys the flag out
		 * and joins `info` in the tooltip; the value is kept. */
		inactiveReason?: string;
	}

	let { label, info, checked = $bindable(), inactiveReason }: Props = $props();

	const tooltip = $derived(
		inactiveReason ? `${info}<br><br><strong>No effect now:</strong> ${inactiveReason}` : info
	);
</script>

<div class="flex items-center gap-2" class:opacity-50={inactiveReason}>
	<label
		class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
	>
		<input
			type="checkbox"
			class="rounded border-gray-300 text-primary focus:ring-primary"
			bind:checked
		/>
		{label}
	</label>
	<HoverInfo iconColor="gray-500" text={tooltip} />
</div>
