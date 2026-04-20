<script lang="ts">
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import Welcome from './Welcome.svelte';

	let { data }: { data: PageData } = $props();
</script>

{#key page.params.lang}
	<Welcome
		initialData={data.welcome}
		availableLanguages={data.available_languages}
		projectName={data.project_name}
	/>
{/key}
