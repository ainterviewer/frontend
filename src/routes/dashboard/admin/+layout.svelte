<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { adminSidebarItems } from '$lib/config/sidebar';

	let { children } = $props();
</script>

<Sidebar items={adminSidebarItems} />
{@render children()}
