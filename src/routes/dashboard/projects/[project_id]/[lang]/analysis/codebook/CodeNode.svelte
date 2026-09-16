<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { displayName, scoreRangeLabel } from '$lib/coding/codingTree';
	import { useRename, type CodeNode } from '$lib/coding/codingTreeState.svelte';
	import { NODE_HEIGHT, NODE_WIDTH } from '$lib/coding/treeLayout';

	let { data, selected }: NodeProps<CodeNode> = $props();

	const rename = useRename();

	const code = $derived(data.code);

	// Handles sit where the edges arrive: a top-down tree joins bottom to top, a
	// left-right one joins right to left. Getting this wrong does not break the
	// graph, it just routes every edge the long way round the node.
	const vertical = $derived(data.direction === 'TB');
	const targetSide = $derived(vertical ? Position.Top : Position.Left);
	const sourceSide = $derived(vertical ? Position.Bottom : Position.Right);

	// A drag hovering this node says what letting go would do. `invalid` is the
	// refusal the tree has to make: a code cannot be dropped into its own branch.
	// What this code would do to a passage, said on the node rather than only in
	// the inspector: a tree where a third of the codes are never applied to
	// anything reads wrong unless you can see which third.
	// The icon carries the kind and the tooltip names it; only a score writes
	// anything out, because its scale is the code's own content rather than a
	// label for what sort of code it is.
	const kindMark = $derived(
		code.kind === 'score'
			? {
					icon: 'fa-sliders',
					label: scoreRangeLabel(code),
					title: `Score, ${scoreRangeLabel(code)}`
				}
			: code.kind === 'group'
				? { icon: 'fa-layer-group', label: '', title: 'Group — organises, never applied' }
				: { icon: 'fa-tag', label: '', title: 'Tag' }
	);

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

<!-- Two elements on purpose. The card clips, so that the branch stripe follows
     its rounded corners; the handles sit on the card's edge with half their
     width outside it, and anything clipped is not hit-testable -- which loses
     the outer half of every handle, and with it half the target for the two
     gestures that start from one. So the handles live on the wrapper, outside
     the clip. -->
<div class="relative" style:width="{NODE_WIDTH}px" style:height="{NODE_HEIGHT}px">
	<Handle type="target" position={targetSide} class="!h-2 !w-2 !border-white !bg-gray-300" />

	<!-- The ring colour has to be set on the ringed element itself: Tailwind
	     registers `--tw-ring-color` as a non-inheriting custom property, so a
	     value set on the wrapper never reaches here. -->
	<!-- A double click renames. The first click of it has already selected the
	     code, so this is the second half of a gesture the reader has started,
	     rather than a shortcut they have to know about. Stopped here so it does
	     not also reach the pane, which reads a double click as zoom in. -->
	<div
		class="relative h-full overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md {ring}"
		style:--tw-ring-color={selected && data.drop === 'none' ? code.color : undefined}
		ondblclick={(event) => {
			event.stopPropagation();
			rename();
		}}
		role="presentation"
	>
		<!-- The branch's colour, carried on every node under it. -->
		<div class="absolute inset-y-0 left-0 w-1" style:background-color={code.color}></div>

		<div class="flex h-full flex-col justify-center gap-0.5 py-2 pr-2 pl-3">
			<p class="line-clamp-2 text-sm leading-tight font-medium text-gray-800">
				{displayName(code.name)}
			</p>
			<div class="flex items-center gap-2 text-[11px] text-gray-400">
				<span class="flex items-center gap-1" title={kindMark.title}>
					<i class="fas {kindMark.icon}"></i>
					{#if kindMark.label}<span>{kindMark.label}</span>{/if}
				</span>
				{#if data.childCount > 0}
					<span>{data.childCount} sub-code{data.childCount === 1 ? '' : 's'}</span>
				{/if}
				{#if code.definition.trim() === '' && code.kind !== 'group'}
					<!-- A code without a definition is not yet a code anyone else can
					     apply, so the gap is worth showing on the node rather than
					     only in the inspector. Not asked of a group: nothing is coded
					     there, so there is no rule for a second coder to follow. -->
					<span class="text-amber-600">no definition</span>
				{/if}
				{#if code.memo.trim() !== ''}
					<i class="fas fa-note-sticky" title="Has a memo"></i>
				{/if}
			</div>
		</div>
	</div>

	<Handle type="source" position={sourceSide} class="!h-2 !w-2 !border-white !bg-gray-300" />
</div>
