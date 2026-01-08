<script lang="ts">
	import type { PageData } from './$types';
	import Welcome from './Welcome.svelte';

	let { data }: { data: PageData } = $props();
</script>

<Welcome initialData={data.welcome} />
