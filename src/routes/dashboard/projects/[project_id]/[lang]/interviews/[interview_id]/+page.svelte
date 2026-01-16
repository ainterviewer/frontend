<script lang="ts">
	import type { PageData } from './$types';
	import InterviewDetail from '../../components/InterviewDetail.svelte';

	let { data }: { data: PageData } = $props();
</script>

<InterviewDetail
	{data}
	backLink={`/dashboard/projects/${data.project_id}/${data.lang}/interviews`}
/>
