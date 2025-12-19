<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { mainSidebarItems } from '$lib/config/sidebar';
</script>

<Sidebar items={mainSidebarItems} />
<h1 class="page-title text-5xl">
	Welcome to <span class="bg-linear-to-r from-dark to-primary bg-clip-text text-transparent"
		>AInterviewer</span
	>
</h1>
