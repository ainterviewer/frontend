<script lang="ts">
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import Consent from './Consent.svelte';

	let { data }: { data: PageData } = $props();
</script>

{#key page.params.lang}
	<Consent
		initialData={data.consent}
		availableLanguages={data.available_languages}
		projectName={data.project_name}
	/>
{/key}
