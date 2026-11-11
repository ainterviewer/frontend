<script lang="ts" generics="Row extends { key: string; email: string; role: CollaboratorRole }">
	import type { Snippet } from 'svelte';

	import type { CollaboratorRole } from '$lib/api';
	import Select from '$lib/components/Select.svelte';

	import { inputClass } from './DashboardModal.svelte';
	import RoleInfo from './RoleInfo.svelte';

	interface Props {
		rows: Row[];
		/** The roles offered, some perhaps disabled. */
		roleItems: { value: CollaboratorRole; label: string; disabled?: boolean }[];
		/** Whether the reader may change or remove a row; all by default. */
		canManage?: (row: Row) => boolean;
		onRoleChange: (row: Row, role: CollaboratorRole) => void;
		onRemove: (row: Row) => void;
		/** Stages someone; false keeps what was typed, as for a duplicate. */
		onAdd: (email: string, role: CollaboratorRole) => boolean;
		/** A line under a row's email, such as its invitation's state. */
		note?: Snippet<[Row]>;
		removeLabel?: (row: Row) => string;
		/** What is typed in the add row and not yet added, so the dialog can
		 * add it on submit rather than drop it. */
		draft?: { email: string; role: CollaboratorRole };
	}

	let {
		rows,
		roleItems,
		canManage = () => true,
		onRoleChange,
		onRemove,
		onAdd,
		note,
		removeLabel = () => 'Remove collaborator',
		draft = $bindable({ email: '', role: 'viewer' })
	}: Props = $props();

	function add() {
		const email = draft.email.trim();
		if (!email || !onAdd(email, draft.role)) return;
		draft = { email: '', role: 'viewer' };
	}
</script>

<div>
	<div
		class="mb-1.5 grid grid-cols-[1fr_8rem_2.25rem] gap-2 pl-3 text-xs font-semibold tracking-wide text-gray-500 uppercase"
	>
		<span>Email</span>
		<span class="flex items-center gap-1 normal-case">
			<span class="uppercase">Role</span>
			<RoleInfo />
		</span>
	</div>

	{#if rows.length === 0}
		<p
			class="rounded-md border border-dashed border-gray-200 px-3 py-3 text-center text-sm text-gray-500"
		>
			No collaborators yet.
		</p>
	{:else}
		<ul class="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
			{#each rows as row (row.key)}
				{@const manageable = canManage(row)}
				<li class="grid grid-cols-[1fr_8rem_2.25rem] items-center gap-2 py-2 pl-3">
					<div class="flex min-w-0 items-center gap-2.5">
						<span
							class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary uppercase"
							aria-hidden="true"
						>
							{row.email.charAt(0)}
						</span>
						<div class="min-w-0">
							<span class="block truncate text-sm font-medium text-gray-900" title={row.email}>
								{row.email}
							</span>
							{#if note}
								<span class="block text-xs text-gray-500">{@render note(row)}</span>
							{/if}
						</div>
					</div>
					<Select
						items={roleItems}
						bind:value={() => row.role, (value) => onRoleChange(row, value as CollaboratorRole)}
						disabled={!manageable}
						class="h-9"
						aria-label="Role of {row.email}"
					/>
					{#if manageable}
						<button
							type="button"
							class="flex size-9 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:outline-none"
							onclick={() => onRemove(row)}
							aria-label={removeLabel(row)}
							title={removeLabel(row)}
						>
							<i class="fa-solid fa-trash-can"></i>
						</button>
					{:else}
						<span></span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<div class="mt-3 grid grid-cols-[1fr_8rem_2.25rem] items-center gap-2">
		<input
			type="email"
			class={inputClass}
			placeholder="name@example.com"
			aria-label="Collaborator email"
			bind:value={draft.email}
			onkeydown={(e) => {
				// Enter adds the person here rather than submitting the dialog.
				if (e.key === 'Enter') {
					e.preventDefault();
					add();
				}
			}}
		/>
		<Select items={roleItems} bind:value={draft.role} class="h-10" aria-label="Role" />
		<button
			type="button"
			class="flex size-9 items-center justify-center rounded-md bg-primary text-white hover:bg-dark disabled:opacity-50"
			onclick={add}
			disabled={!draft.email.trim()}
			aria-label="Add collaborator to the list"
			title="Add to the list"
		>
			<i class="fa-solid fa-plus"></i>
		</button>
	</div>
</div>
