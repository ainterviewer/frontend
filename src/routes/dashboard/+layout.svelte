<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { WhatsNewModal } from '$lib/components/modals';
	import { sidebar } from '$lib/sidebar.svelte';
	import { whatsNew } from '$lib/whatsNew.svelte';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	// Read the "already seen" marker after hydration rather than at module load,
	// so the server and the first client render agree.
	$effect(() => {
		whatsNew.hydrate();
	});
</script>

<Header {data} />

<!-- Rendered once here: the sidebar is per-route, but both it and the header
     open this dialog. -->
<WhatsNewModal releases={data.releases} />

<div class="bg-dark">
	<!-- How tall a table card may grow before it scrolls its own rows instead of
	     pushing the page down; DataTable reads this. Derived from this element:
	     the viewport less the header above it (mt-11), its own py-10, and the
	     spacer at the foot of the column below, leaving roughly a page heading's
	     worth of room so the card still ends inside the viewport. -->
	<main
		style="--table-max-h: calc(100vh - 2.75rem - 5rem - 2.5rem - 3.5rem)"
		class={[
			'mt-11 flex h-[calc(100vh-2.75rem)] flex-col items-center overflow-y-auto rounded-b-[10px] border-r-6 border-b-6 border-r-dark border-b-dark bg-light py-10 transition-all duration-500',
			sidebar.collapsed ? 'ml-[70px]' : 'ml-[250px]'
		].join(' ')}
	>
		<div class="flex min-h-full w-[90%] flex-col">
			{@render children()}
			<div aria-hidden="true" class="h-10 shrink-0"></div>
		</div>
	</main>
</div>
