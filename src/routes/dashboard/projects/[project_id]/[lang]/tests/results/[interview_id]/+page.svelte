<script lang="ts">
	import InterviewDetail from '$lib/components/interview/InterviewDetail.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<InterviewDetail
	{data}
	backLink={`/dashboard/projects/${data.project_id}/${data.lang}/tests/results`}
/>
