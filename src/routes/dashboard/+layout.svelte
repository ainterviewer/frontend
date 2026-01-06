<script lang="ts">
	import { auth } from '$lib/auth.svelte';
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
		class="mt-11 ml-[250px] flex h-[calc(100vh-2.75rem)] flex-col items-center overflow-scroll rounded-b-[10px] border-r-6 border-b-6 border-r-dark border-b-dark bg-light py-10"
	>
		<div class="w-[90%]">
			{@render children()}
		</div>
	</main>
</div>
