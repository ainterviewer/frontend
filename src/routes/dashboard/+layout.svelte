<script lang="ts">
	import { auth } from '$lib/auth.svelte';
	import { sidebar } from '$lib/sidebar.svelte';
	import Header from '$lib/components/Header.svelte';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	$effect(() => {
		console.log(data.user);
		auth.setUser(data.user);
	});
</script>

<Header {data} />

<div class="bg-dark">
	<main
		class={[
			'mt-11 flex h-[calc(100vh-2.75rem)] flex-col items-center overflow-scroll rounded-b-[10px] border-r-6 border-b-6 border-r-dark border-b-dark bg-light py-10 transition-all duration-500',
			sidebar.collapsed ? 'ml-[70px]' : 'ml-[250px]'
		].join(' ')}
	>
		<div class="w-[90%]">
			{@render children()}
		</div>
	</main>
</div>
