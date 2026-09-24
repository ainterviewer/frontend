<script lang="ts">
	let { title, description }: { title: string; description: string } = $props();
</script>

<!-- z-20: above DataTable's sticky z-10 header cells, which would otherwise win on DOM order. -->
<div class="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-gray-500/50">
	<div class="rounded-lg bg-white px-6 py-4 text-center shadow-lg">
		<p class="text-lg font-semibold text-gray-800">{title}</p>
		<p class="mt-1 text-sm text-gray-600">{description}</p>
	</div>
</div>
