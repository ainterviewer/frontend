<script lang="ts">
	import { Admin } from '$lib/api';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import FacetedFilter from '$lib/components/table/FacetedFilter.svelte';
	import {
		dataTableFeatures,
		matchesSelection,
		NO_PAGINATION,
		sortableText,
		type DataTableFeatures
	} from '$lib/components/table/features';
	import { createColumnHelper, createTable } from '@tanstack/svelte-table';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';
	import type { Instance, PoolSettings, PoolSettingsPatch, SettingsByService } from './types';

	let { data }: { data: PageData } = $props();

	let instances: Instance[] = $state([]);
	let isLoading = $state(false);
	let error = $state('');

	// HTML time inputs use "HH:MM"; the backend uses "HH:MM:SS".
	const toInputTime = (t: string) => t.slice(0, 5);
	const toBackendTime = (t: string) => (t.length === 5 ? `${t}:00` : t);

	/* ------------------------------------------------------- pool settings */

	// Each pool is configured separately, so the form edits a *patch* and the
	// checkboxes choose which pools it lands on. Only fields the user actually
	// touches are sent: applying the whole form to several pools would flatten
	// settings they never looked at onto one value.
	// Derived rather than plain state so a re-run of the loader is picked up;
	// assigning the response of a save overrides it until then.
	let settings = $derived(data.settings);
	let patch = $state<PoolSettingsPatch>({});

	let services = $derived(Object.keys(settings).sort());

	// `null` means "not chosen yet", which reads as everything. Selection is
	// filtered against the services that actually exist, so a pool disappearing
	// from the config cannot leave a checked ghost behind.
	let chosenServices = $state<string[] | null>(null);
	let selectedServices = $derived.by(() => {
		const chosen = chosenServices;
		return chosen === null ? services : services.filter((s) => chosen.includes(s));
	});

	let allSelected = $derived(services.length > 0 && selectedServices.length === services.length);
	let someSelected = $derived(selectedServices.length > 0 && !allSelected);

	function toggleAllServices() {
		chosenServices = allSelected ? [] : [...services];
	}

	function toggleService(service: string) {
		// Rebuilt from `services` so the stored order stays the displayed one.
		chosenServices = selectedServices.includes(service)
			? selectedServices.filter((s) => s !== service)
			: services.filter((s) => selectedServices.includes(s) || s === service);
	}

	const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

	/**
	 * What the selected pools agree on for one field.
	 *
	 * `mixed` when they disagree: the input then shows no value and stays out
	 * of the patch until the user sets one, so saving cannot silently level
	 * pools that were deliberately configured apart.
	 */
	function shared<K extends keyof PoolSettings>(
		field: K
	): { value: PoolSettings[K] | undefined; mixed: boolean } {
		const values = selectedServices
			.map((service) => settings[service])
			.filter((pool) => pool !== undefined)
			.map((pool) => pool[field]);

		if (values.length === 0) return { value: undefined, mixed: false };

		const mixed = values.some((value) => !sameValue(value, values[0]));
		return { value: mixed ? undefined : values[0], mixed };
	}

	const PATCH_FIELDS = ['min_instances_running', 'start_check', 'stop_check', 'downtime'] as const;

	/**
	 * The patch with no-op fields dropped.
	 *
	 * Setting a field back to what the selected pools already had is not a
	 * change, even though the key is still in `patch` -- toggling a checkbox on
	 * and off again would otherwise leave the form looking edited and send a
	 * write that alters nothing. Recomputed when the selection changes, since
	 * the same value can be redundant for one pool and a real edit for another.
	 */
	let effectivePatch = $derived.by(() => {
		const result: PoolSettingsPatch = {};

		for (const field of PATCH_FIELDS) {
			const value = patch[field];
			// `downtime: null` is a real value ("no window"); only `undefined`
			// means the user never set the field.
			if (value === undefined) continue;

			const current = shared(field);
			// Mixed pools are never redundant: picking a value levels them.
			if (!current.mixed && sameValue(current.value, value)) continue;

			Object.assign(result, { [field]: value });
		}

		return result;
	});

	let isDirty = $derived(Object.keys(effectivePatch).length > 0);
	let canUpdate = $derived(isDirty && selectedServices.length > 0);

	let minShared = $derived(shared('min_instances_running'));
	let minValue = $derived(patch.min_instances_running ?? minShared.value);
	let minMixed = $derived(patch.min_instances_running === undefined && minShared.mixed);

	let startShared = $derived(shared('start_check'));
	let startValue = $derived(patch.start_check ?? startShared.value ?? false);
	let startMixed = $derived(patch.start_check === undefined && startShared.mixed);

	let stopShared = $derived(shared('stop_check'));
	let stopValue = $derived(patch.stop_check ?? stopShared.value ?? false);
	let stopMixed = $derived(patch.stop_check === undefined && stopShared.mixed);

	let downtimeShared = $derived(shared('downtime'));
	let downtimeValue = $derived(
		patch.downtime !== undefined ? patch.downtime : downtimeShared.value
	);
	let downtimeMixed = $derived(patch.downtime === undefined && downtimeShared.mixed);
	let downtimeEnabled = $derived(!downtimeMixed && !!downtimeValue);
	let downtimeStart = $derived(downtimeValue ? toInputTime(downtimeValue[0]) : '00:00');
	let downtimeEnd = $derived(downtimeValue ? toInputTime(downtimeValue[1]) : '00:00');

	function setDowntime(from: string, to: string) {
		patch.downtime = [toBackendTime(from), toBackendTime(to)];
	}

	/** One line describing a pool as it stands, so the checkbox is informed. */
	function summarise(service: string) {
		const pool = settings[service];
		if (!pool) return '';

		const window = pool.downtime
			? `down ${toInputTime(pool.downtime[0])}\u2013${toInputTime(pool.downtime[1])}`
			: '24/7';

		return [
			`min ${pool.min_instances_running}`,
			pool.max_instances === null ? 'no max' : `max ${pool.max_instances}`,
			pool.start_check ? 'start on' : 'start off',
			pool.stop_check ? 'stop on' : 'stop off',
			window
		].join(' \u00b7 ');
	}

	function formatTimeEstimate(seconds: number) {
		const decimalHours = seconds / 3600;
		const hours = Math.floor(decimalHours);
		const minutes = Math.round((decimalHours - hours) * 60);

		if (hours) {
			return `${hours} hours ${minutes} min.`;
		} else {
			return `${minutes} min.`;
		}
	}

	async function getInstanceStatus() {
		if (isLoading) return;
		isLoading = true;
		error = '';

		try {
			const response = await Admin.proxyToEc2ManagerGet({
				path: { full_path: 'instances/status' }
			});

			if (response.error) {
				throw new Error('Failed to fetch status');
			}

			instances = response.data as Instance[];
		} catch (err) {
			console.error(err);
			error =
				'Failed to fetch instance status: ' +
				(err instanceof Error && err.message ? err.message : 'Unknown error');
		} finally {
			isLoading = false;
		}
	}

	async function updateSettings() {
		if (!canUpdate) return;

		const targets = [...selectedServices];
		const { data: updated, error: updateError } = await Admin.proxyToEc2ManagerPost({
			path: { full_path: 'settings' },
			// The EC2 manager proxy passes the body through, but the generated
			// OpenAPI spec declares no body schema (typed as `never`), so cast.
			body: { services: targets, settings: effectivePatch } as unknown as never
		});
		if (updateError) {
			toast.error('Failed to update settings');
			return;
		}

		// The proxy answers with the full map, so the panel shows what actually
		// landed rather than assuming the write went through as sent.
		settings = updated as SettingsByService;
		patch = {};
		toast.success(
			targets.length === 1
				? `Settings updated for ${targets[0]}`
				: `Settings updated for ${targets.length} services`
		);
	}

	async function startSelected() {
		if (selectedIds.length === 0) return;

		if (table.getIsAllRowsSelected()) {
			const { error: startError } = await Admin.proxyToEc2ManagerPost({
				path: { full_path: 'instances/start-all' }
			});
			if (startError) {
				error = 'Failed to start instances';
				toast.error(error);
				return;
			}
		} else {
			const results = await Promise.all(
				selectedIds.map((id) =>
					Admin.proxyToEc2ManagerPost({
						path: { full_path: `instances/start/${id}` }
					})
				)
			);
			const failed = results.filter((r) => r.error);
			if (failed.length > 0) {
				error = `Failed to start ${failed.length} instance(s)`;
				toast.error(error);
				return;
			}
		}
		await getInstanceStatus();
		table.resetRowSelection(true);
		toast.success('Instances starting');
	}

	async function stopSelected() {
		if (selectedIds.length === 0) return;

		if (table.getIsAllRowsSelected()) {
			const { error: stopError } = await Admin.proxyToEc2ManagerPost({
				path: { full_path: 'instances/stop-all' }
			});
			if (stopError) {
				error = 'Failed to stop instances';
				toast.error(error);
				return;
			}
		} else {
			const results = await Promise.all(
				selectedIds.map((id) =>
					Admin.proxyToEc2ManagerPost({
						path: { full_path: `instances/stop/${id}` }
					})
				)
			);
			const failed = results.filter((r) => r.error);
			if (failed.length > 0) {
				error = `Failed to stop ${failed.length} instance(s)`;
				toast.error(error);
				return;
			}
		}
		await getInstanceStatus();
		table.resetRowSelection(true);
		toast.success('Instances stopping');
	}

	function getStatusColor(status: string) {
		const s = status.toLowerCase();
		if (s === 'running' || s === 'success') return 'bg-green-100 text-green-800 ring-green-600/20';
		if (s === 'stopped' || s === 'error') return 'bg-red-100 text-red-800 ring-red-600/20';
		if (['starting', 'pending', 'stopping'].includes(s))
			return 'bg-yellow-100 text-yellow-800 ring-yellow-600/20';
		return 'bg-gray-100 text-gray-800 ring-gray-500/10';
	}

	onMount(() => {
		getInstanceStatus();
	});

	/* ---------------------------------------------------------------- table */

	const helper = createColumnHelper<DataTableFeatures, Instance>();

	const columns = helper.columns([
		helper.display({ id: 'select', enableHiding: false }),
		helper.group({
			id: 'ec2',
			header: 'EC2',
			columns: helper.columns([
				helper.accessor((i) => sortableText(i.name), {
					id: 'name',
					header: 'Instance name',
					sortFn: 'text',
					sortUndefined: 'last',
					meta: { class: 'font-medium whitespace-nowrap text-dark' }
				}),
				helper.accessor((i) => sortableText(i.service), {
					id: 'service',
					header: 'Service',
					sortFn: 'text',
					sortUndefined: 'last',
					filterFn: matchesSelection,
					meta: { class: 'whitespace-nowrap' }
				}),
				helper.accessor((i) => sortableText(i.state), {
					id: 'state',
					header: 'State',
					sortFn: 'text',
					sortUndefined: 'last',
					filterFn: matchesSelection
				}),
				helper.accessor((i) => sortableText(i.instance_type), {
					id: 'instance_type',
					header: 'Type',
					sortFn: 'text',
					sortUndefined: 'last',
					filterFn: matchesSelection,
					meta: { class: 'whitespace-nowrap text-gray-600' }
				}),
				helper.accessor((i) => sortableText(i.id), {
					id: 'id',
					header: 'ID',
					sortFn: 'text',
					sortUndefined: 'last',
					meta: { class: 'font-mono text-xs whitespace-nowrap text-gray-500' }
				}),
				helper.accessor((i) => sortableText(i.model), {
					id: 'model',
					header: 'Model',
					sortFn: 'text',
					sortUndefined: 'last',
					meta: { class: 'whitespace-nowrap text-gray-600' }
				})
			])
		}),
		// The inference-server columns render under their own spanning header,
		// with a dashed rule marking the boundary through the whole table. Which
		// server they describe depends on the row's service: vLLM for llm, TEI
		// for embedding.
		helper.group({
			id: 'server',
			header: 'Inference server',
			meta: { groupStart: true },
			columns: helper.columns([
				helper.accessor((i) => sortableText(i.server.status), {
					id: 'server_status',
					header: 'Status',
					sortFn: 'text',
					sortUndefined: 'last',
					filterFn: matchesSelection,
					meta: { groupStart: true, class: 'whitespace-nowrap' }
				}),
				helper.accessor((i) => sortableText(i.server.models?.[0]?.name), {
					id: 'server_model',
					header: 'Model',
					sortFn: 'text',
					sortUndefined: 'last',
					meta: { class: 'whitespace-nowrap text-gray-600' }
				}),
				helper.accessor((i) => i.connections ?? 0, {
					id: 'connections',
					header: 'Conn.',
					sortFn: 'basic',
					meta: { align: 'center', class: 'tabular-nums text-gray-600' }
				}),
				helper.accessor((i) => i.idle_time ?? 0, {
					id: 'idle_time',
					header: 'Idle',
					sortFn: 'basic',
					meta: { align: 'right', class: 'whitespace-nowrap tabular-nums text-gray-600' }
				})
			])
		})
	]);

	const table = createTable({
		features: dataTableFeatures,
		columns,
		get data() {
			return instances;
		},
		getRowId: (i) => i.id,
		globalFilterFn: 'includesString',
		getColumnCanGlobalFilter: (column) => ['name', 'id', 'model', 'service'].includes(column.id),
		initialState: { pagination: NO_PAGINATION, sorting: [{ id: 'name', desc: false }] }
	});

	const selectedIds = $derived(table.getSelectedRowIds());

	const columnLabels: Record<string, string> = {
		name: 'Instance name',
		service: 'Service',
		state: 'State',
		instance_type: 'Type',
		id: 'ID',
		model: 'Model',
		server: 'Inference server',
		server_status: 'Server status',
		server_model: 'Server model',
		connections: 'Connections',
		idle_time: 'Idle'
	};
</script>

<div class="sm:flex sm:items-center">
	<div class="sm:flex-auto">
		<h1 class="page-title">AWS</h1>
		<p class="mt-2 text-sm text-gray-700">Manage your EC2 instances and settings.</p>
	</div>
</div>

<div class="mt-8 mb-4 flex flex-wrap items-end justify-between gap-3">
	<h2 class="text-lg font-semibold text-dark">EC2 Instances</h2>
	<button
		type="button"
		class="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
		onclick={getInstanceStatus}
		disabled={isLoading}
		title="Refresh status"
		aria-label="Refresh status"
	>
		<i class="fa-solid fa-arrows-rotate {isLoading ? 'animate-spin' : ''}"></i>
	</button>
</div>

{#if error}
	<div class="mt-4 rounded-md bg-red-50 p-4">
		<div class="flex">
			<div class="flex-shrink-0">
				<i class="fa-solid fa-circle-exclamation text-red-400"></i>
			</div>
			<div class="ml-3">
				<h3 class="text-sm font-medium text-red-800">Error</h3>
				<div class="mt-2 text-sm text-red-700">
					<p>{error}</p>
				</div>
			</div>
		</div>
	</div>
{/if}

<DataTable
	{table}
	{columnLabels}
	loading={isLoading}
	search
	rowLabel="instance"
	searchPlaceholder="Search name, ID, model or service..."
	emptyTitle="No instances"
	emptyDescription="Nothing is running right now."
>
	{#snippet selectionActions()}
		<button
			class="ml-1 flex items-center gap-1.5 rounded px-2 py-0.5 text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
			onclick={startSelected}
			disabled={isLoading}
		>
			<i class="fa-solid fa-play text-xs"></i>
			Start
		</button>
		<button
			class="flex items-center gap-1.5 rounded px-2 py-0.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
			onclick={stopSelected}
			disabled={isLoading}
		>
			<i class="fa-solid fa-stop text-xs"></i>
			Stop
		</button>
	{/snippet}

	{#snippet filters()}
		{#if table.getColumn('service')}
			<FacetedFilter title="Service" column={table.getColumn('service')!} />
		{/if}
		{#if table.getColumn('state')}
			<FacetedFilter title="State" column={table.getColumn('state')!} />
		{/if}
		{#if table.getColumn('server_status')}
			<FacetedFilter title="Server status" column={table.getColumn('server_status')!} />
		{/if}
	{/snippet}

	{#snippet cell(columnId, row)}
		{@const instance = row.original}
		{#if columnId === 'name'}
			{instance.name}
		{:else if columnId === 'service'}
			<span
				class="inline-flex items-center rounded-md bg-secondary/40 px-2 py-1 text-xs font-medium text-dark ring-1 ring-gray-200 ring-inset"
			>
				{instance.service}
			</span>
		{:else if columnId === 'state'}
			<span
				class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset {getStatusColor(
					instance.state
				)}"
			>
				{instance.state}
			</span>
		{:else if columnId === 'instance_type'}
			{instance.instance_type}
		{:else if columnId === 'id'}
			{instance.id}
		{:else if columnId === 'model'}
			{#if instance.model}{instance.model}{:else}<span class="text-gray-300">&ndash;</span>{/if}
		{:else if columnId === 'server_status'}
			<span
				class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset {getStatusColor(
					instance.server.status
				)}"
			>
				{instance.server.status}
			</span>
		{:else if columnId === 'server_model'}
			{#if instance.server.models?.[0]?.name}{instance.server.models[0].name}{:else}<span
					class="text-gray-300">&ndash;</span
				>{/if}
		{:else if columnId === 'connections'}
			{instance.connections}
		{:else if columnId === 'idle_time'}
			{formatTimeEstimate(instance.idle_time)}
		{/if}
	{/snippet}
</DataTable>

<div class="mt-8 max-w-3xl rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
	<div class="flex items-start justify-between gap-x-6">
		<div class="min-w-0">
			<h3 class="text-base leading-7 font-semibold text-dark">Configuration</h3>
			<p class="mt-1 text-sm text-gray-500">
				Applies to the checked services. Fields you don't change are left as they are.
			</p>
		</div>
		<!--
			Both controls hold their footprint whether or not there is anything to
			save. A button that appears from nothing, or a label that grows, reflows
			the header and shoves the whole form down the moment a setting is
			touched.
		-->
		<div class="flex shrink-0 items-center gap-3">
			<button
				type="button"
				class="text-sm text-gray-500 underline-offset-2 hover:text-dark hover:underline"
				class:invisible={!isDirty}
				disabled={!isDirty}
				onclick={() => (patch = {})}
			>
				Discard
			</button>
			<button
				type="button"
				class="w-fit rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary shadow-sm hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
				disabled={!canUpdate}
				onclick={updateSettings}
			>
				Update
			</button>
		</div>
	</div>

	<div class="mt-4 grid gap-x-6 gap-y-6 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
		<fieldset class="rounded-md border border-gray-200 p-3">
			<legend class="px-1 text-sm leading-6 font-medium text-gray-900">Services</legend>

			{#if services.length === 0}
				<p class="text-sm text-gray-500">No pools reported by the proxy.</p>
			{:else}
				<label class="flex items-center gap-2 border-b border-gray-100 pb-2 text-sm text-gray-900">
					<input
						type="checkbox"
						class="h-4 w-4 cursor-pointer rounded border-gray-400 text-primary focus:ring-primary"
						checked={allSelected}
						indeterminate={someSelected}
						onchange={toggleAllServices}
					/>
					<span class="font-medium">
						{allSelected ? 'Uncheck all' : 'Check all'}
					</span>
					<span class="ml-auto text-xs text-gray-500">
						{selectedServices.length} of {services.length} selected
					</span>
				</label>

				<div class="mt-2 flex flex-col gap-2">
					{#each services as service (service)}
						<label
							class="flex items-start gap-2 rounded-md px-1 py-1 text-sm text-gray-900 hover:bg-secondary/20"
						>
							<input
								type="checkbox"
								class="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-400 text-primary focus:ring-primary"
								value={service}
								checked={selectedServices.includes(service)}
								onchange={() => toggleService(service)}
							/>
							<span class="min-w-0">
								<span class="font-medium">{service}</span>
								<span class="block text-xs break-words text-gray-500">{summarise(service)}</span>
							</span>
						</label>
					{/each}
				</div>
			{/if}
		</fieldset>

		<div
			class="divide-y divide-gray-100"
			class:pointer-events-none={selectedServices.length === 0}
			class:opacity-50={selectedServices.length === 0}
		>
			<div class="flex items-center justify-between gap-4 py-3 first:pt-0">
				<div class="min-w-0">
					<label for="min-instances" class="block text-sm font-medium text-gray-900"
						>Minimum instances</label
					>
					<p class="mt-0.5 text-xs text-gray-500">
						Kept running even when idle, outside the downtime window.
					</p>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					{#if minMixed}
						{@render mixed()}
					{/if}
					<input
						type="number"
						id="min-instances"
						min="0"
						value={minValue ?? ''}
						placeholder={minMixed ? '—' : ''}
						disabled={selectedServices.length === 0}
						oninput={(e) => {
							const raw = e.currentTarget.value;
							if (raw === '') {
								delete patch.min_instances_running;
							} else {
								patch.min_instances_running = Number(raw);
							}
						}}
						class="block w-20 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-primary focus:ring-inset sm:text-sm sm:leading-6"
					/>
				</div>
			</div>

			<div class="flex items-center justify-between gap-4 py-3">
				<div class="min-w-0">
					<label for="start-check" class="block text-sm font-medium text-gray-900"
						>Start check</label
					>
					<p class="mt-0.5 text-xs text-gray-500">
						Start another instance when the pool runs out of capacity.
					</p>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					{#if startMixed}
						{@render mixed()}
					{/if}
					<input
						type="checkbox"
						id="start-check"
						checked={startValue}
						indeterminate={startMixed}
						disabled={selectedServices.length === 0}
						onchange={(e) => (patch.start_check = e.currentTarget.checked)}
						class="h-5 w-5 cursor-pointer rounded border-gray-300 text-primary shadow-sm transition duration-150 ease-out hover:border-primary focus:ring-2 focus:ring-primary/40 focus:ring-offset-1"
					/>
				</div>
			</div>

			<div class="flex items-center justify-between gap-4 py-3">
				<div class="min-w-0">
					<label for="stop-check" class="block text-sm font-medium text-gray-900">Stop check</label>
					<p class="mt-0.5 text-xs text-gray-500">
						Stop instances that have been idle past the unload time.
					</p>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					{#if stopMixed}
						{@render mixed()}
					{/if}
					<input
						id="stop-check"
						type="checkbox"
						checked={stopValue}
						indeterminate={stopMixed}
						disabled={selectedServices.length === 0}
						onchange={(e) => (patch.stop_check = e.currentTarget.checked)}
						class="h-5 w-5 cursor-pointer rounded border-gray-300 text-primary shadow-sm transition duration-150 ease-out hover:border-primary focus:ring-2 focus:ring-primary/40 focus:ring-offset-1"
					/>
				</div>
			</div>

			<div class="py-3 last:pb-0">
				<div class="flex items-center justify-between gap-4">
					<div class="min-w-0">
						<label for="downtime-check" class="block text-sm font-medium text-gray-900"
							>Downtime window</label
						>
						<p class="mt-0.5 text-xs text-gray-500">
							Instances may be stopped in this window, minimum or not.
						</p>
					</div>
					<div class="flex shrink-0 items-center gap-2">
						{#if downtimeMixed}
							{@render mixed()}
						{/if}
						<input
							id="downtime-check"
							type="checkbox"
							checked={downtimeEnabled}
							indeterminate={downtimeMixed}
							disabled={selectedServices.length === 0}
							onchange={(e) => {
								if (e.currentTarget.checked) {
									setDowntime(downtimeStart, downtimeEnd);
								} else {
									patch.downtime = null;
								}
							}}
							class="h-5 w-5 cursor-pointer rounded border-gray-300 text-primary shadow-sm transition duration-150 ease-out hover:border-primary focus:ring-2 focus:ring-primary/40 focus:ring-offset-1"
						/>
					</div>
				</div>

				{#if downtimeEnabled}
					<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
						<div class="flex items-center gap-2">
							<label for="downtime-start" class="text-sm text-gray-600">From</label>
							<input
								id="downtime-start"
								type="time"
								lang="en-GB"
								value={downtimeStart}
								onchange={(e) => setDowntime(e.currentTarget.value, downtimeEnd)}
								class="block rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-primary focus:ring-inset sm:text-sm sm:leading-6"
							/>
						</div>
						<div class="flex items-center gap-2">
							<label for="downtime-end" class="text-sm text-gray-600">to</label>
							<input
								id="downtime-end"
								type="time"
								lang="en-GB"
								value={downtimeEnd}
								onchange={(e) => setDowntime(downtimeStart, e.currentTarget.value)}
								class="block rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-primary focus:ring-inset sm:text-sm sm:leading-6"
							/>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

{#snippet mixed()}
	<span
		class="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 ring-inset"
		title="The selected services differ here. Leave it alone to keep each one as it is."
	>
		Mixed
	</span>
{/snippet}
