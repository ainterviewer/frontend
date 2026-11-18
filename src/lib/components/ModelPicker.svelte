<!--
@component
A model picker in the style of the header's project switcher: a searchable
popover listing the models a project may use, grouped by whether
respondents' answers may be sent to them (`test_only`, see
`$lib/content/models`). Single choice binds `value`; with `multiple` it binds
`values` and stays open while models are ticked.
-->
<script lang="ts">
	import { Popover } from 'bits-ui';
	import { fly } from 'svelte/transition';

	import type { ModelOption } from '$lib/api/types.gen';
	import { describeModel, withCurrent } from '$lib/content/models';

	let {
		models,
		value = $bindable(''),
		values = $bindable([]),
		multiple = false,
		max,
		placeholder = 'Choose a model',
		id,
		disabled = false,
		label = 'Choose a model',
		onchange
	}: {
		models: ModelOption[];
		/** The chosen model, single choice. '' for none. */
		value?: string;
		/** The chosen models, with `multiple`. */
		values?: string[];
		multiple?: boolean;
		/** With `multiple`, how many may be ticked. */
		max?: number;
		/** Shown in the trigger while nothing is chosen. */
		placeholder?: string;
		/** For a `<label for>` outside. */
		id?: string;
		disabled?: boolean;
		/** The popover's heading and the trigger's accessible name. */
		label?: string;
		/** Called with the new choice after it is made. */
		onchange?: (value: string) => void;
	} = $props();

	let open = $state(false);
	let query = $state('');
	let highlighted = $state(0);
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- written from an attachment, read from a key handler; nothing renders from it
	const rows = new Map<string, HTMLElement>();

	// A configured model no longer offered is kept, so the trigger can name it.
	let options = $derived(multiple ? models : withCurrent(models, value));

	let groups = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		const shown = needle ? options.filter((m) => m.id.toLowerCase().includes(needle)) : options;
		return [
			{
				key: 'respondents',
				title: 'For respondents',
				note: null,
				models: shown.filter((m) => !m.test_only)
			},
			{
				key: 'test',
				title: 'Test interviews only',
				note: "Respondents' answers may not be sent to these.",
				models: shown.filter((m) => m.test_only)
			}
		].filter((group) => group.models.length > 0);
	});

	let flat = $derived(groups.flatMap((group) => group.models));

	let chosen = $derived(options.find((m) => m.id === value));
	let full = $derived(max !== undefined && values.length >= max);

	function isChosen(model: ModelOption) {
		return multiple ? values.includes(model.id) : model.id === value;
	}

	function onOpenChange(next: boolean) {
		if (!next) return;
		query = '';
		const current = flat.findIndex((m) => isChosen(m));
		highlighted = Math.max(current, 0);
	}

	function select(model: ModelOption) {
		if (multiple) {
			if (values.includes(model.id)) values = values.filter((v) => v !== model.id);
			else if (!full) values = [...values, model.id];
			onchange?.(model.id);
			return;
		}
		value = model.id;
		open = false;
		onchange?.(model.id);
	}

	function move(delta: number) {
		if (flat.length === 0) return;
		highlighted = Math.min(Math.max(highlighted + delta, 0), flat.length - 1);
		rows.get(flat[highlighted].id)?.scrollIntoView({ block: 'nearest' });
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			move(1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			move(-1);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const model = flat[highlighted];
			if (model) select(model);
		}
	}
</script>

{#snippet testOnlyBadge()}
	<span
		class="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-amber-800"
	>
		Test only
	</span>
{/snippet}

<Popover.Root bind:open {onOpenChange}>
	<Popover.Trigger
		{id}
		{disabled}
		aria-label={label}
		class="flex w-full min-w-64 cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 shadow-sm hover:border-gray-400 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
	>
		{#if multiple}
			{#if values.length === 0}
				<span class="flex-1 truncate text-gray-500">{placeholder}</span>
			{:else}
				<span class="flex-1 truncate">
					{values.map((v) => describeModel(v).name).join(', ')}
				</span>
				<span class="shrink-0 text-xs text-gray-500">{values.length}</span>
			{/if}
		{:else if chosen}
			{@const { provider, name } = describeModel(chosen.id)}
			<span class="min-w-0 flex-1 truncate">
				{name}
				<span class="text-xs text-gray-500">&middot; {provider}</span>
			</span>
			{#if chosen.test_only}{@render testOnlyBadge()}{/if}
		{:else}
			<span class="flex-1 truncate text-gray-500">{placeholder}</span>
		{/if}
		<i class="fa-solid fa-chevron-down text-[0.6rem] text-gray-500"></i>
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			class="z-2000 w-96 overflow-hidden rounded-md border border-gray-200 bg-white text-gray-900 shadow-lg focus:outline-none"
			sideOffset={4}
			align="start"
			forceMount
		>
			{#snippet child({ wrapperProps, props, open: contentOpen })}
				{#if contentOpen}
					<div {...wrapperProps}>
						<div {...props} transition:fly={{ duration: 150, y: -5 }} {onkeydown}>
							<div
								class="flex items-baseline justify-between border-b border-gray-200 px-3 py-2 text-sm font-semibold"
							>
								{label}
								{#if multiple && max !== undefined}
									<span class="text-xs font-normal text-gray-500">
										{values.length} of at most {max}
									</span>
								{/if}
							</div>
							<div class="border-b border-gray-200 p-2">
								<div class="relative">
									<i
										class="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-gray-400"
									></i>
									<!-- svelte-ignore a11y_autofocus -->
									<input
										autofocus
										type="text"
										bind:value={query}
										oninput={() => (highlighted = 0)}
										placeholder="Search models"
										aria-label="Search models"
										class="w-full rounded-md border border-gray-300 py-1.5 pr-2 pl-7 text-sm placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
									/>
								</div>
							</div>
							<div
								class="max-h-80 overflow-y-auto py-1"
								role="listbox"
								aria-label={label}
								aria-multiselectable={multiple}
							>
								{#if flat.length === 0}
									<p class="px-3 py-4 text-center text-sm text-gray-500">No models found.</p>
								{:else}
									{#each groups as group (group.key)}
										<div class="px-3 pt-2 pb-1">
											<div
												class="text-[0.65rem] font-semibold tracking-wide text-gray-400 uppercase"
											>
												{group.title}
											</div>
											{#if group.note}
												<div class="text-xs text-gray-400">{group.note}</div>
											{/if}
										</div>
										{#each group.models as model (model.id)}
											{@const index = flat.indexOf(model)}
											{@const { provider, name } = describeModel(model.id)}
											{@const selected = isChosen(model)}
											{@const blocked = multiple && full && !selected}
											<button
												type="button"
												role="option"
												aria-selected={selected}
												disabled={blocked}
												{@attach (node) => {
													rows.set(model.id, node);
													return () => rows.delete(model.id);
												}}
												onclick={() => select(model)}
												onmouseenter={() => (highlighted = index)}
												class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 {highlighted ===
												index
													? 'bg-gray-100'
													: 'bg-transparent'}"
											>
												<span class="w-3.5 shrink-0 text-xs text-primary">
													{#if multiple}
														<i
															class={selected ? 'fa-solid fa-square-check' : 'fa-regular fa-square'}
														></i>
													{:else if selected}
														<i class="fa-solid fa-check"></i>
													{/if}
												</span>
												<span class="min-w-0 flex-1">
													<span class="block truncate">{name}</span>
													<span class="block text-xs text-gray-400">{provider}</span>
												</span>
											</button>
										{/each}
									{/each}
								{/if}
							</div>
						</div>
					</div>
				{/if}
			{/snippet}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
