<script lang="ts">
	import { CODE_KINDS, displayName, type Code, type CodeKind } from './codingTree';
	import type { CodingTreeState } from './codingTreeState.svelte';

	let {
		tree,
		code,
		onDelete
	}: {
		tree: CodingTreeState;
		code: Code;
		/** The page owns deletion, because it is the one that can offer the undo. */
		onDelete: (id: string) => void;
	} = $props();

	const KIND_COPY: Record<CodeKind, { label: string; icon: string; help: string }> = {
		group: {
			label: 'Group',
			icon: 'fa-layer-group',
			help: 'A heading. Organises the codes under it and holds the thinking about them, but is never applied to a passage itself.'
		},
		tag: {
			label: 'Tag',
			icon: 'fa-tag',
			help: 'Applies to a passage or it does not. The ordinary case.'
		},
		score: {
			label: 'Score',
			icon: 'fa-sliders',
			help: 'Asks for a number on a fixed scale. Write what each end means into the definition, or a second coder cannot reproduce it.'
		}
	};

	const trail = $derived(tree.ancestorsOf(code.id).toReversed());
	const children = $derived(tree.childrenOf(code.id));

	/** An empty number field is no value, not a zero. */
	function numberOrNull(raw: string): number | null {
		const trimmed = raw.trim();
		if (trimmed === '') return null;
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : null;
	}

	let nameField = $state<HTMLInputElement | null>(null);

	/**
	 * Whether the swatches are being applied or edited.
	 *
	 * Two different scopes share one row of colours: clicking a swatch paints
	 * this branch, while editing one changes the codebook's palette and every
	 * branch already painted from it. Putting the second behind a switch keeps
	 * the first a single unambiguous click, and makes the wider change something
	 * the reader asked for rather than something they hit.
	 */
	let editingPalette = $state(false);

	/**
	 * The caret goes to the name only when something asks for it -- a code just
	 * created, or a double click on a node -- never merely because the selection
	 * changed.
	 *
	 * The request is matched against this code and then consumed, so it is
	 * answered exactly once by exactly the panel it was meant for. The match is
	 * also what keeps this from firing between keystrokes: every edit hands the
	 * panel a fresh code object, so this effect re-runs on each character typed
	 * and has to have a reason to do nothing.
	 *
	 * The name is selected, not just focused: both callers are renames, and the
	 * text being replaced is a placeholder or a name the reader has decided is
	 * wrong.
	 */
	$effect(() => {
		if (tree.nameFocusFor !== code.id) return;
		tree.consumeNameFocus();
		nameField?.focus();
		nameField?.select();
	});
</script>

<aside class="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-white">
	<div class="border-b border-gray-100 px-4 py-3">
		{#if trail.length > 0}
			<nav class="mb-1 flex flex-wrap items-center gap-1 text-[11px] text-gray-400">
				{#each trail as ancestor, index (ancestor.id)}
					<button
						class="max-w-32 truncate hover:text-gray-700 hover:underline"
						onclick={() => (tree.selectedId = ancestor.id)}
					>
						{displayName(ancestor.name)}
					</button>
					{#if index < trail.length - 1}<span>/</span>{/if}
				{/each}
			</nav>
		{/if}
		<label class="block">
			<span class="sr-only">Code name</span>
			<input
				bind:this={nameField}
				class="w-full rounded border-0 px-0 text-lg font-semibold text-gray-800 focus:ring-0"
				value={code.name}
				placeholder="Untitled code"
				oninput={(event) =>
					tree.patch(code.id, { name: event.currentTarget.value }, `name:${code.id}`)}
				onblur={() => tree.endEdit()}
			/>
		</label>
	</div>

	<div class="space-y-5 px-4 py-4">
		<div>
			<div class="mb-2 flex items-center justify-between">
				<span class="text-xs font-medium tracking-wide text-gray-500 uppercase">
					Branch colour
				</span>
				<button
					class="text-[11px] text-gray-400 hover:text-gray-700 hover:underline"
					onclick={() => (editingPalette = !editingPalette)}
				>
					{editingPalette ? 'Done' : 'Edit palette'}
				</button>
			</div>

			{#if editingPalette}
				<ul class="space-y-1.5">
					{#each tree.palette as color, index (index)}
						{@const usage = tree.colorUsage(color)}
						<li class="flex items-center gap-2">
							<input
								class="h-6 w-6 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0"
								type="color"
								value={color}
								aria-label="Palette colour {index + 1}"
								oninput={(event) => tree.setColor(index, event.currentTarget.value)}
								onblur={() => tree.endEdit()}
							/>
							<!-- Committed on change rather than on input: a half-typed hex is
							     not a colour, and re-rendering the field under someone mid-word
							     would move their caret. -->
							<input
								class="w-24 rounded border-gray-200 font-mono text-xs text-gray-600 uppercase focus:border-primary focus:ring-primary"
								type="text"
								value={color}
								aria-label="Palette colour {index + 1} hex"
								onchange={(event) => tree.setColor(index, event.currentTarget.value)}
							/>
							<span class="flex-1 truncate text-[11px] text-gray-400">
								{usage === 0 ? 'unused' : `${usage} ${usage === 1 ? 'code' : 'codes'}`}
							</span>
							<button
								class="rounded px-1.5 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
								disabled={tree.palette.length <= 1}
								title={tree.palette.length <= 1
									? 'The palette needs at least one colour'
									: usage === 0
										? 'Remove this colour'
										: `Remove this colour — ${usage} ${usage === 1 ? 'code' : 'codes'} will be repainted`}
								aria-label="Remove palette colour {index + 1}"
								onclick={() => tree.removeColor(index)}
							>
								<i class="fas fa-xmark"></i>
							</button>
						</li>
					{/each}
				</ul>
				<button
					class="mt-2 w-full rounded border border-dashed border-gray-200 px-2 py-1.5 text-[11px] text-gray-500 hover:border-gray-300 hover:text-gray-700"
					onclick={() => tree.addColor()}
				>
					<i class="fas fa-plus mr-1"></i> Add colour
				</button>
				<p class="mt-2 text-[11px] text-gray-400">
					The palette belongs to the codebook. Changing a colour moves every branch painted with it;
					removing one repaints those branches with the first colour here.
				</p>
			{:else}
				<div class="flex flex-wrap gap-2">
					<!-- Keyed by position, not by colour: two entries may briefly hold the
					     same hue while one is being edited. -->
					{#each tree.palette as color, index (index)}
						<button
							class="h-6 w-6 rounded-full ring-offset-2 transition {code.color === color
								? 'ring-2 ring-gray-400'
								: 'hover:ring-2 hover:ring-gray-200'}"
							style:background-color={color}
							aria-label="Colour this branch {color}"
							aria-pressed={code.color === color}
							onclick={() => tree.recolorBranch(code.id, color)}
						></button>
					{/each}
				</div>
				<p class="mt-2 text-[11px] text-gray-400">Applies to this code and everything under it.</p>
			{/if}
		</div>

		<div>
			<span class="mb-2 block text-xs font-medium tracking-wide text-gray-500 uppercase">
				Kind
			</span>
			<div class="flex rounded border border-gray-200 p-0.5">
				{#each CODE_KINDS as kind (kind)}
					<button
						class="flex-1 rounded px-2 py-1.5 text-xs font-medium transition {code.kind === kind
							? 'bg-gray-800 text-white'
							: 'text-gray-500 hover:bg-gray-50'}"
						aria-pressed={code.kind === kind}
						onclick={() => tree.setKind(code.id, kind)}
					>
						<i class="fas {KIND_COPY[kind].icon} mr-1"></i>{KIND_COPY[kind].label}
					</button>
				{/each}
			</div>
			<p class="mt-2 text-[11px] text-gray-400">{KIND_COPY[code.kind].help}</p>

			{#if code.kind === 'score'}
				<!-- The ends are editable because scales differ by study: a 0-10
				     agreement scale and a 1-5 rating are both ordinary, and forcing
				     one on the other is how a codebook stops matching the guide. -->
				<div class="mt-3 flex items-end gap-3">
					<label class="block">
						<span class="mb-1 block text-[11px] text-gray-500">Min</span>
						<input
							class="w-20 rounded border-gray-200 text-sm text-gray-700 focus:border-primary focus:ring-primary"
							type="number"
							value={code.minValue}
							oninput={(event) =>
								tree.setScoreBound(code.id, 'min', numberOrNull(event.currentTarget.value))}
							onblur={() => tree.endEdit()}
						/>
					</label>
					<label class="block">
						<span class="mb-1 block text-[11px] text-gray-500">Max</span>
						<input
							class="w-20 rounded border-gray-200 text-sm text-gray-700 focus:border-primary focus:ring-primary"
							type="number"
							value={code.maxValue}
							oninput={(event) =>
								tree.setScoreBound(code.id, 'max', numberOrNull(event.currentTarget.value))}
							onblur={() => tree.endEdit()}
						/>
					</label>
				</div>
			{/if}
		</div>

		<label class="block">
			<span class="mb-1 block text-xs font-medium tracking-wide text-gray-500 uppercase">
				Definition
			</span>
			<!-- The inclusion rule, not a description: this is what a second coder
			     reads before deciding whether a passage belongs here. -->
			<textarea
				class="w-full resize-y rounded border-gray-200 text-sm text-gray-700 focus:border-primary focus:ring-primary"
				rows="6"
				value={code.definition}
				placeholder={code.kind === 'score'
					? 'What is being rated, and what do the ends of the scale mean?'
					: code.kind === 'group'
						? 'What this part of the codebook is for.'
						: 'What counts as this code? What does not?'}
				oninput={(event) =>
					tree.patch(code.id, { definition: event.currentTarget.value }, `def:${code.id}`)}
				onblur={() => tree.endEdit()}
			></textarea>
		</label>

		<label class="block">
			<span class="mb-1 block text-xs font-medium tracking-wide text-gray-500 uppercase">
				Memo
			</span>
			<!-- Kept apart from the definition on purpose. The definition is a rule
			     others apply; the memo is the analyst's own thinking about it, and
			     mixing the two is how codebooks become unusable to a second coder. -->
			<textarea
				class="w-full resize-y rounded border-gray-200 text-sm text-gray-700 focus:border-primary focus:ring-primary"
				rows="5"
				value={code.memo}
				placeholder="Why this code exists, what it borders on, what you are unsure about."
				oninput={(event) =>
					tree.patch(code.id, { memo: event.currentTarget.value }, `memo:${code.id}`)}
				onblur={() => tree.endEdit()}
			></textarea>
		</label>

		{#if children.length > 0}
			<div>
				<span class="mb-2 block text-xs font-medium tracking-wide text-gray-500 uppercase">
					Sub-codes
				</span>
				<ul class="space-y-1">
					{#each children as child (child.id)}
						<li>
							<button
								class="w-full truncate rounded px-2 py-1 text-left text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
								onclick={() => (tree.selectedId = child.id)}
							>
								{displayName(child.name)}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<div class="mt-auto space-y-2 border-t border-gray-100 px-4 py-3">
		<button
			class="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:opacity-90"
			onclick={() => tree.addChild(code.id)}
		>
			<i class="fas fa-plus mr-1"></i> Add sub-code
		</button>
		{#if code.parentId !== null}
			<button
				class="w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
				onclick={() => tree.moveUnder(code.id, null)}
			>
				<i class="fas fa-arrow-turn-up mr-1"></i> Make top-level
			</button>
		{/if}
		<button
			class="w-full rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50"
			onclick={() => onDelete(code.id)}
		>
			<i class="fas fa-trash mr-1"></i>
			Delete{children.length > 0 ? ' with sub-codes' : ''}
		</button>
	</div>
</aside>

<style>
	/* The native colour input draws its own square swatch inside the element, so
	   rounding the input alone leaves a square sitting in a circle -- and the two
	   modes stop looking like the same row of colours. */
	input[type='color'] {
		-webkit-appearance: none;
		appearance: none;
	}

	input[type='color']::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	input[type='color']::-webkit-color-swatch {
		border: none;
		border-radius: 9999px;
	}

	input[type='color']::-moz-color-swatch {
		border: none;
		border-radius: 9999px;
	}
</style>
