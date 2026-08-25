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
	import type { Instance } from './types';

	let { data }: { data: PageData } = $props();

	let instances: Instance[] = $state([]);
	let isLoading = $state(false);
	let error = $state('');
	let minInstances = $derived(data.settings.min_instances);
	let startCheck = $derived(data.settings.start);
	let stopCheck = $derived(data.settings.stop);

	// HTML time inputs use "HH:MM"; the backend uses "HH:MM:SS".
	const toInputTime = (t: string) => t.slice(0, 5);
	const toBackendTime = (t: string) => (t.length === 5 ? `${t}:00` : t);

	let downtimeEnabled = $derived(data.settings.ec2_downtime !== null);
	let downtimeStart = $derived(
		data.settings.ec2_downtime ? toInputTime(data.settings.ec2_downtime[0]) : '00:00'
	);
	let downtimeEnd = $derived(
		data.settings.ec2_downtime ? toInputTime(data.settings.ec2_downtime[1]) : '00:00'
	);

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
		const { error: updateError } = await Admin.proxyToEc2ManagerPost({
			path: { full_path: 'settings' },
			// The EC2 manager proxy passes the body through, but the generated
			// OpenAPI spec declares no body schema (typed as `never`), so cast.
			body: {
				min_instances: minInstances,
				start: startCheck,
				stop: stopCheck,
				ec2_downtime: downtimeEnabled
					? [toBackendTime(downtimeStart), toBackendTime(downtimeEnd)]
					: null
			} as unknown as never
		});
		if (updateError) {
			toast.error('Failed to update settings');
			return;
		}
		toast.success('Settings updated');
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
		// The vLLM columns render under their own spanning header, with a dashed
		// rule marking the boundary through the whole table.
		helper.group({
			id: 'vllm',
			header: 'vLLM',
			meta: { groupStart: true },
			columns: helper.columns([
				helper.accessor((i) => sortableText(i.vllm.status), {
					id: 'vllm_status',
					header: 'Status',
					sortFn: 'text',
					sortUndefined: 'last',
					filterFn: matchesSelection,
					meta: { groupStart: true, class: 'whitespace-nowrap' }
				}),
				helper.accessor((i) => sortableText(i.vllm.models?.[0]?.name), {
					id: 'vllm_model',
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
		getColumnCanGlobalFilter: (column) => ['name', 'id', 'model'].includes(column.id),
		initialState: { pagination: NO_PAGINATION, sorting: [{ id: 'name', desc: false }] }
	});

	const selectedIds = $derived(table.getSelectedRowIds());

	const columnLabels: Record<string, string> = {
		name: 'Instance name',
		state: 'State',
		instance_type: 'Type',
		id: 'ID',
		model: 'Model',
		vllm: 'vLLM',
		vllm_status: 'vLLM status',
		vllm_model: 'vLLM model',
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
	searchPlaceholder="Search name, ID or model..."
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
		{#if table.getColumn('state')}
			<FacetedFilter title="State" column={table.getColumn('state')!} />
		{/if}
		{#if table.getColumn('vllm_status')}
			<FacetedFilter title="vLLM status" column={table.getColumn('vllm_status')!} />
		{/if}
	{/snippet}

	{#snippet cell(columnId, row)}
		{@const instance = row.original}
		{#if columnId === 'name'}
			{instance.name}
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
		{:else if columnId === 'vllm_status'}
			<span
				class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset {getStatusColor(
					instance.vllm.status
				)}"
			>
				{instance.vllm.status}
			</span>
		{:else if columnId === 'vllm_model'}
			{#if instance.vllm.models?.[0]?.name}{instance.vllm.models[0].name}{:else}<span
					class="text-gray-300">&ndash;</span
				>{/if}
		{:else if columnId === 'connections'}
			{instance.connections}
		{:else if columnId === 'idle_time'}
			{formatTimeEstimate(instance.idle_time)}
		{/if}
	{/snippet}
</DataTable>

<div class="mt-8 shrink-0 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:max-w-md">
	<h3 class="text-base leading-7 font-semibold text-dark">Configuration</h3>
	<div class="mt-4 flex flex-col gap-4">
		<div>
			<label for="min-instances" class="mb-1 block text-sm leading-6 font-medium text-gray-900"
				>Minimum Instances</label
			>
			<div class="flex-none">
				<input
					type="number"
					id="min-instances"
					bind:value={minInstances}
					class="block w-20 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-primary focus:ring-inset sm:text-sm sm:leading-6"
				/>
			</div>
		</div>

		<div>
			<label for="start-check" class="mb-1 block text-sm leading-6 font-medium text-gray-900"
				>Start Check</label
			>
			<div class="flex-none">
				<input
					type="checkbox"
					id="start-check"
					bind:checked={startCheck}
					class="h-5 w-5 cursor-pointer rounded border-gray-300 text-primary shadow-sm transition duration-150 ease-out hover:border-primary focus:ring-2 focus:ring-primary/40 focus:ring-offset-1"
				/>
			</div>
		</div>
		<div>
			<label for="stop-check" class="mb-1 block text-sm leading-6 font-medium text-gray-900"
				>Stop Check</label
			>
			<div class="flex-none">
				<input
					id="stop-check"
					type="checkbox"
					bind:checked={stopCheck}
					class="h-5 w-5 cursor-pointer rounded border-gray-300 text-primary shadow-sm transition duration-150 ease-out hover:border-primary focus:ring-2 focus:ring-primary/40 focus:ring-offset-1"
				/>
			</div>
		</div>
		<div>
			<div class="flex items-start gap-3">
				<div class="flex-[1.2] py-1">
					<label for="downtime-check" class="mb-1 block text-sm leading-6 font-medium text-gray-900"
						>EC2 Downtime</label
					>
					<input
						id="downtime-check"
						type="checkbox"
						bind:checked={downtimeEnabled}
						class="mt-1.5 h-5 w-5 cursor-pointer rounded border-gray-300 text-primary shadow-sm transition duration-150 ease-out hover:border-primary focus:ring-2 focus:ring-primary/40 focus:ring-offset-1"
					/>
				</div>
				{#if downtimeEnabled}
					<div class="flex-1">
						<label
							for="downtime-start"
							class="mb-1 block text-right text-sm leading-6 font-medium text-gray-900">From</label
						>
						<input
							id="downtime-start"
							type="time"
							lang="en-GB"
							bind:value={downtimeStart}
							class="ml-auto block rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-primary focus:ring-inset sm:text-sm sm:leading-6"
						/>
					</div>
					<div class="flex-1">
						<label
							for="downtime-end"
							class="mb-1 block text-right text-sm leading-6 font-medium text-gray-900">To</label
						>
						<input
							id="downtime-end"
							type="time"
							lang="en-GB"
							bind:value={downtimeEnd}
							class="ml-auto block rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-primary focus:ring-inset sm:text-sm sm:leading-6"
						/>
					</div>
				{/if}
			</div>
		</div>
		<button
			type="button"
			class="w-fit rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary shadow-sm hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
			onclick={updateSettings}
		>
			Update
		</button>
	</div>
</div>
