<script lang="ts">
	let { children } = $props();
</script>

<div class="flex min-h-[calc(100vh)] bg-dark">
	<div class="m-auto size-200 content-center rounded-full bg-white p-25">
		{@render children()}
	</div>
</div>
