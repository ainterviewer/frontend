<script lang="ts">
	import type { PageData } from './$types';
	import Consent from './Consent.svelte';

	let { data }: { data: PageData } = $props();
</script>

<Consent initialData={data.consent} />
