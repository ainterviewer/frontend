<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { displayName } from './codingTree';
	import type { CodeNode } from './codingTreeState.svelte';
	import { NODE_HEIGHT, NODE_WIDTH } from './treeLayout';

	let { data, selected }: NodeProps<CodeNode> = $props();

	const code = $derived(data.code);

	// Handles sit where the edges arrive: a top-down tree joins bottom to top, a
	// left-right one joins right to left. Getting this wrong does not break the
	// graph, it just routes every edge the long way round the node.
	const vertical = $derived(data.direction === 'TB');
	const targetSide = $derived(vertical ? Position.Top : Position.Left);
	const sourceSide = $derived(vertical ? Position.Bottom : Position.Right);

	// A drag hovering this node says what letting go would do. `invalid` is the
	// refusal the tree has to make: a code cannot be dropped into its own branch.
	const ring = $derived(
		data.drop === 'valid'
			? 'ring-2 ring-emerald-500 ring-offset-1'
			: data.drop === 'invalid'
				? 'ring-2 ring-red-400 ring-offset-1'
				: selected
					? 'ring-2 ring-offset-1'
					: 'ring-1 ring-gray-200'
	);
</script>

<div
	class="group relative flex flex-col justify-between overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md {ring}"
	style:width="{NODE_WIDTH}px"
	style:height="{NODE_HEIGHT}px"
	style:--tw-ring-color={selected && data.drop === 'none' ? code.color : undefined}
>
	<!-- The branch's colour, carried on every node under it. -->
	<div class="absolute inset-y-0 left-0 w-1" style:background-color={code.color}></div>

	<Handle type="target" position={targetSide} class="!h-2 !w-2 !border-white !bg-gray-300" />

	<div class="flex h-full flex-col justify-center gap-0.5 py-2 pr-2 pl-3">
		<p class="line-clamp-2 text-sm leading-tight font-medium text-gray-800">
			{displayName(code.name)}
		</p>
		<div class="flex items-center gap-2 text-[11px] text-gray-400">
			{#if data.childCount > 0}
				<span>{data.childCount} sub-code{data.childCount === 1 ? '' : 's'}</span>
			{/if}
			{#if code.definition.trim() === ''}
				<!-- A code without a definition is not yet a code anyone else can
				     apply, so the gap is worth showing on the node rather than
				     only in the inspector. -->
				<span class="text-amber-600">no definition</span>
			{/if}
			{#if code.memo.trim() !== ''}
				<i class="fas fa-note-sticky" title="Has a memo"></i>
			{/if}
		</div>
	</div>

	<Handle type="source" position={sourceSide} class="!h-2 !w-2 !border-white !bg-gray-300" />
</div>
