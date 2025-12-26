<script lang="ts">
	import InterviewGuide from './InterviewGuide.svelte';
	let { data } = $props();
</script>

{#key data.guide}
	<InterviewGuide guide={data.guide} />
{/key}
