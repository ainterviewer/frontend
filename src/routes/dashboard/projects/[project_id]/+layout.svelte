<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { projectSidebarItems } from '$lib/config/sidebar';

	let { children } = $props();
</script>

<Sidebar items={projectSidebarItems} />
{@render children()}
