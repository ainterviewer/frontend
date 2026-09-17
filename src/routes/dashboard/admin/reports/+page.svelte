<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Admin } from '$lib/api';
	import type { MessageReportRowPublic, ReportStatus } from '$lib/api/types.gen';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import FacetedFilter from '$lib/components/table/FacetedFilter.svelte';
	import {
		dataTableFeatures,
		formatDate,
		formatDateFull,
		matchesSelection,
		NO_PAGINATION,
		sortableText,
		sortableTime,
		type DataTableFeatures
	} from '$lib/components/table/features';
	import { errorMessage } from '$lib/utils/errors';
	import { createColumnHelper, createTable } from '@tanstack/svelte-table';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	/**
	 * Every question a respondent has reported, across all projects.
	 *
	 * This page acts on the *platform* track only — `admin_status` and its
	 * resolver. Each project has its own queue over the same rows, and clearing
	 * a report here does not clear it there: an owner deciding to reword a
	 * question and the platform reviewing it for safety are different
	 * judgements, and neither should silently stand in for the other. The
	 * project's own status is shown, greyed, so a reviewer can see whether
	 * anyone there has looked — not so it can be changed from here.
	 */

	let { data }: { data: PageData } = $props();

	let reports = $derived(data.reports as MessageReportRowPublic[]);
	let isLoading = $state(false);
	// A writable `$derived`: it starts as whatever the load function reported
	// and is reset by it on every navigation or `invalidateAll`, but the
	// action handlers below also assign their own failures to it. Syncing the
	// two with an `$effect` would be the same thing written less honestly.
	let error = $derived<string | null>(data.error);

	/* ---------------------------------------------------------------- table */

	const helper = createColumnHelper<DataTableFeatures, MessageReportRowPublic>();

	const columns = helper.columns([
		helper.display({ id: 'select', enableHiding: false }),
		helper.accessor((r) => sortableTime(r.created_at), {
			id: 'created_at',
			header: 'Reported',
			sortFn: 'basic',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap tabular-nums text-gray-600' }
		}),
		helper.accessor((r) => sortableText(r.project_title), {
			id: 'project_title',
			header: 'Project',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'whitespace-nowrap font-medium text-dark' }
		}),
		helper.accessor((r) => sortableText(r.question), {
			id: 'question',
			header: 'Question',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'max-w-md truncate text-gray-700' }
		}),
		helper.accessor('reason', {
			header: 'Reason',
			sortFn: 'text',
			filterFn: matchesSelection
		}),
		helper.accessor((r) => sortableText(r.comment), {
			id: 'comment',
			header: 'Comment',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'max-w-xs truncate text-gray-600' }
		}),
		helper.accessor('admin_status', {
			header: 'Platform review',
			sortFn: 'text',
			filterFn: matchesSelection
		}),
		helper.accessor('status', {
			header: 'Project review',
			sortFn: 'text',
			filterFn: matchesSelection
		}),
		helper.accessor((r) => (r.read_by_me ? 'read' : 'unread'), {
			id: 'read_by_me',
			header: 'Read',
			sortFn: 'text',
			filterFn: matchesSelection
		}),
		helper.accessor((r) => sortableText(r.pid), {
			id: 'pid',
			header: 'PID',
			sortFn: 'text',
			sortUndefined: 'last',
			meta: { class: 'font-mono text-xs whitespace-nowrap text-gray-600' }
		}),
		helper.accessor('language', { header: 'Language', meta: { class: 'text-gray-600' } })
	]);

	const searchableColumns = ['project_title', 'question', 'comment', 'pid'];

	const table = createTable({
		features: dataTableFeatures,
		columns,
		get data() {
			return reports;
		},
		getRowId: (r) => r.id,
		globalFilterFn: 'includesString',
		getColumnCanGlobalFilter: (column) => searchableColumns.includes(column.id),
		initialState: { pagination: NO_PAGINATION, sorting: [{ id: 'created_at', desc: true }] }
	});

	const columnLabels: Record<string, string> = {
		created_at: 'Reported',
		project_title: 'Project',
		question: 'Question',
		reason: 'Reason',
		comment: 'Comment',
		admin_status: 'Platform review',
		status: 'Project review',
		read_by_me: 'Read',
		pid: 'PID',
		language: 'Language'
	};

	const selectedIds = $derived(table.getSelectedRowIds());

	const openUnread = $derived(
		reports.filter((report) => report.admin_status === 'open' && !report.read_by_me).length
	);

	/* --------------------------------------------------------------- actions */

	async function reload() {
		if (isLoading) return;
		isLoading = true;
		error = null;
		try {
			await invalidateAll();
			table.resetRowSelection(true);
		} catch (e) {
			error = errorMessage(e) || 'Failed to fetch reports';
		} finally {
			isLoading = false;
		}
	}

	const STATUS_VERB: Record<ReportStatus, string> = {
		resolved: 'resolved',
		dismissed: 'dismissed',
		open: 'reopened'
	};

	async function setStatus(status: ReportStatus) {
		const ids = selectedIds;
		if (ids.length === 0) {
			toast.error('Please select one or more reports.');
			return;
		}

		isLoading = true;
		try {
			const response = await Admin.resolveReports({ body: { ids, status } });
			if (response.error) throw new Error(String(response.error));
			isLoading = false;
			await reload();
			toast.success(`Reports ${STATUS_VERB[status]}`);
		} catch (e) {
			error = `Failed to update reports: ${errorMessage(e)}`;
			toast.error(error);
			isLoading = false;
		}
	}

	async function markRead() {
		const ids = selectedIds;
		if (ids.length === 0) {
			toast.error('Please select one or more reports.');
			return;
		}

		isLoading = true;
		try {
			const response = await Admin.markReportsRead({ body: { ids } });
			if (response.error) throw new Error(String(response.error));
			isLoading = false;
			await reload();
			toast.success('Reports marked as read');
		} catch (e) {
			error = `Failed to mark reports as read: ${errorMessage(e)}`;
			toast.error(error);
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>AInterviewer - Reported Questions</title>
</svelte:head>

<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
	<div class="flex items-baseline gap-3">
		<h2 class="page-title mb-0">Reported Questions</h2>
		{#if openUnread > 0}
			<span class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
				{openUnread} unread
			</span>
		{/if}
	</div>
	<button
		class="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
		onclick={reload}
		title="Refresh"
		aria-label="Refresh"
		disabled={isLoading}
	>
		<i class="fa-solid fa-arrows-rotate {isLoading ? 'animate-spin' : ''}"></i>
	</button>
</div>

{#if error}
	<div
		class="relative mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
		role="alert"
	>
		<strong class="font-bold">Error:</strong>
		<span class="block sm:inline">{error}</span>
	</div>
{/if}

<DataTable
	{table}
	{columnLabels}
	loading={isLoading}
	hasLoaded={!isLoading || reports.length > 0}
	search
	rowLabel="report"
	searchPlaceholder="Search project, question, comment or PID..."
	emptyTitle="No reported questions"
	emptyDescription="Reports appear here when a respondent flags a question during an interview."
>
	{#snippet filters()}
		<FacetedFilter title="Reason" column={table.getColumn('reason')!} />
		<FacetedFilter title="Platform review" column={table.getColumn('admin_status')!} />
		<FacetedFilter title="Read" column={table.getColumn('read_by_me')!} />
	{/snippet}

	{#snippet selectionActions()}
		<button
			class="ml-1 flex items-center gap-1.5 rounded px-2 py-0.5 text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
			onclick={() => setStatus('resolved')}
			disabled={isLoading}
		>
			<i class="fa-solid fa-circle-check text-xs"></i>
			Resolve
		</button>
		<button
			class="flex items-center gap-1.5 rounded px-2 py-0.5 text-gray-700 hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-40"
			onclick={() => setStatus('dismissed')}
			disabled={isLoading}
		>
			<i class="fa-solid fa-ban text-xs"></i>
			Dismiss
		</button>
		<button
			class="flex items-center gap-1.5 rounded px-2 py-0.5 text-gray-700 hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-40"
			onclick={() => setStatus('open')}
			disabled={isLoading}
		>
			<i class="fa-solid fa-rotate-left text-xs"></i>
			Reopen
		</button>
		<button
			class="flex items-center gap-1.5 rounded px-2 py-0.5 text-gray-700 hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-40"
			onclick={markRead}
			disabled={isLoading}
		>
			<i class="fa-solid fa-envelope-open text-xs"></i>
			Mark read
		</button>
	{/snippet}

	{#snippet cell(columnId, row)}
		{@const report = row.original}
		{#if columnId === 'created_at'}
			<span title={formatDateFull(report.created_at)}>
				{formatDate(report.created_at)}
			</span>
		{:else if columnId === 'project_title'}
			{report.project_title}
		{:else if columnId === 'question'}
			<!--
				Straight to the reported question: the transcript highlights and
				scrolls to `?message`. The interview's own language, not the
				reviewer's — `[lang]` picks which localization of the guide the
				transcript annotates its questions with, and annotating a Danish
				interview from the English guide would label the questions from a
				text the respondent never saw. Admin scope bypasses the project
				role check, so this opens for any project.
			-->
			<a
				href="{resolve('/dashboard/projects/[project_id]/[lang]/interviews/[interview_id]', {
					project_id: report.project_id,
					lang: (report.language ?? 'en').toLowerCase(),
					interview_id: report.interview_id
				})}?message={report.message_id}"
				class="group/link flex items-center gap-1.5 hover:text-primary hover:underline"
				title="Open the transcript at this question"
				onclick={(e) => e.stopPropagation()}
			>
				<span class="font-mono text-xs text-gray-400">#{report.question_number}</span>
				<span class="truncate">{report.question}</span>
				<i
					class="fa-solid fa-arrow-up-right-from-square shrink-0 text-[10px] text-gray-300 group-hover/link:text-primary"
				></i>
			</a>
		{:else if columnId === 'reason'}
			<span
				class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize
					{report.reason === 'offensive'
					? 'bg-red-100 text-red-800'
					: report.reason === 'inappropriate'
						? 'bg-orange-100 text-orange-800'
						: 'bg-gray-100 text-gray-700'}"
			>
				{report.reason}
			</span>
		{:else if columnId === 'comment'}
			<span title={report.comment || ''}>
				{#if report.comment}{report.comment}{:else}<span class="text-gray-300">&ndash;</span>{/if}
			</span>
		{:else if columnId === 'admin_status'}
			<span
				class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize
					{report.admin_status === 'resolved'
					? 'bg-green-100 text-green-800'
					: report.admin_status === 'dismissed'
						? 'bg-gray-100 text-gray-600'
						: 'bg-amber-100 text-amber-800'}"
			>
				{report.admin_status}
			</span>
		{:else if columnId === 'status'}
			<!-- The project's own track, shown but not actionable from here. -->
			<span class="text-xs text-gray-500 capitalize" title="The project's own review state">
				{report.status}
			</span>
		{:else if columnId === 'read_by_me'}
			{#if report.read_by_me}
				<i class="fa-solid fa-envelope-open text-xs text-gray-300" title="Read"></i>
			{:else}
				<i class="fa-solid fa-envelope text-xs text-amber-600" title="Unread"></i>
			{/if}
		{:else if columnId === 'pid'}
			{#if report.pid}{report.pid}{:else}<span class="text-gray-300">&ndash;</span>{/if}
		{:else if columnId === 'language'}
			{report.language}
		{/if}
	{/snippet}
</DataTable>
