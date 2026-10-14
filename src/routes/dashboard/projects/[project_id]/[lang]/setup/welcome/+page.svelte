<script lang="ts">
	import { page } from '$app/state';

	import type { PageData } from './$types';
	import Welcome from './Welcome.svelte';

	let { data }: { data: PageData } = $props();
</script>

{#key `${page.params.lang}-${data.revision}`}
	<Welcome
		initialData={data.welcome}
		revision={data.revision}
		availableLanguages={data.available_languages}
		projectName={data.project_name}
	/>
{/key}
