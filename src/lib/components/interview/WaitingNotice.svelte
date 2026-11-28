<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';

	import Wave from '../Wave.svelte';

	let { text }: { text: string } = $props();
</script>

<!--
	While the interview waits on its model -- starting up, or busy -- in place
	of the typing dots, which would promise a reply that is not coming yet.
	The wave is the error page's, moving to say something is under way; it
	holds still for anyone who asked for less motion.
-->
<div
	role="status"
	class="mt-4 mb-4 flex flex-col items-center gap-2 text-center text-sm text-gray-500 select-none"
>
	<div aria-hidden="true">
		<Wave className="h-10 w-10" animate={!prefersReducedMotion.current} color="#196858" />
	</div>
	<p class="max-w-md">{text}</p>
</div>
