<script lang="ts">
	import Info from '$lib/components/Info.svelte';
</script>

<Info>
	<div>
		<div class="mb-2 font-bold">Collaborator Role</div>
		<div class="text-sm">
			<div class="mb-2">
				<span class="font-bold text-gray-800">Viewer:</span> Can only view the project information and
				interviews but do no further action
			</div>
			<div class="mb-2">
				<span class="font-bold text-gray-800">Annotator:</span> Can view the project information and view
				and annotate interviews
			</div>
			<div class="mb-2">
				<span class="font-bold text-gray-800">Editor:</span> Can view and edit the interview guide and
				basic configuration
			</div>
			<div>
				<span class="font-bold text-gray-800">Admin:</span> Can change projects status from active to
				inactive and delete projects all together.
			</div>
		</div>
	</div>
</Info>
