<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { mainSidebarItems } from '$lib/config/sidebar';

	let { children } = $props();
</script>

<Sidebar items={mainSidebarItems} />
{@render children()}
