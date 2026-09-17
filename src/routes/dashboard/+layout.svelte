<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Header from '$lib/components/Header.svelte';
	import { WhatsNewModal } from '$lib/components/modals';
	import { sidebar } from '$lib/sidebar.svelte';
	import { whatsNew } from '$lib/whatsNew.svelte';
	import { onMount, type Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	// Read the "already seen" marker after hydration rather than at module load,
	// so the server and the first client render agree.
	$effect(() => {
		whatsNew.hydrate();
	});

	/**
	 * How often an open dashboard re-checks its badge counts.
	 *
	 * Reports arrive over hours, so this is deliberately slow: it exists so a
	 * tab left open all afternoon notices one, not so the count is live. Every
	 * navigation re-runs the layout load anyway, and acting on a report
	 * invalidates it immediately.
	 */
	const NOTIFICATION_POLL_MS = 5 * 60 * 1000;

	onMount(() => {
		// Only `app:notifications` is invalidated, not the whole load: this must
		// not refetch the project, its permissions and the release list every
		// five minutes, and it must not disturb a route's own data.
		const refresh = () => {
			// A hidden tab is not being read, and a laptop that was asleep would
			// otherwise fire every missed interval at once on waking.
			if (document.visibilityState !== 'visible') return;
			invalidate('app:notifications');
		};

		const timer = setInterval(refresh, NOTIFICATION_POLL_MS);
		// Coming back to the tab is exactly when the count is most likely stale.
		document.addEventListener('visibilitychange', refresh);

		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', refresh);
		};
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
	     trailing spacer an action bar brings with it (2.5rem -- the worst case,
	     since a table page may sit above one), leaving roughly a page heading's
	     worth of room so the card still ends inside the viewport. -->
	<main
		style="--table-max-h: calc(100vh - 2.75rem - 5rem - 2.5rem - 3.5rem)"
		class={[
			'mt-11 flex h-[calc(100vh-2.75rem)] flex-col items-center overflow-y-auto rounded-b-[10px] border-r-6 border-b-6 border-r-dark border-b-dark bg-light py-10 transition-all duration-500',
			sidebar.collapsed ? 'ml-[70px]' : 'ml-[250px]'
		].join(' ')}
	>
		<!-- The spacer keeps a route's sticky action bar clear of the container's
		     bottom edge, and has to live out here: inside the route's own
		     min-h-full column it would push the bar up instead of adding scroll
		     below it. It collapses on routes that render no bar, which would
		     otherwise end in dead whitespace. -->
		<div class="group flex min-h-full w-[90%] flex-col">
			{@render children()}
			<div aria-hidden="true" class="h-0 shrink-0 group-has-[[data-action-bar]]:h-10"></div>
		</div>
	</main>
</div>
