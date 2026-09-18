<script lang="ts">
	import type {
		MessageReportAdminRowPublic,
		MessageReportRowPublic,
		ReportStatus
	} from '$lib/api/types.gen';
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
	import { resolve } from '$app/paths';
	import { createColumnHelper, createTable } from '@tanstack/svelte-table';

	/**
	 * A queue of reported questions, for whichever reviewer is looking.
	 *
	 * There are two of them and they differ in one thing: which status column
	 * they act on. A project member resolves the project track, a platform
	 * admin the admin track, and the rows are the same rows — see
	 * `MessageReportTable` for why neither may clear the other's. `track` is
	 * therefore what this component is parameterised by, not the columns: the
	 * acted-on status is shown as a badge and the other one greyed beside it,
	 * whichever way round that falls.
	 *
	 * The reviewer's own actions are the caller's, because they go to different
	 * endpoints; this owns the table, the filters and the row rendering so the
	 * two queues cannot drift apart.
	 */

	/** Either queue's row; the admin one carries the platform's review as well. */
	type QueueRow = MessageReportRowPublic | MessageReportAdminRowPublic;

	interface Props {
		/**
		 * Admin rows are a superset, so both queues pass through here — but only
		 * the admin one has `admin_status` to show, which is why the column is
		 * built conditionally below.
		 */
		rows: QueueRow[];
		/** Which review track this queue acts on. */
		track: 'owner' | 'admin';
		loading?: boolean;
		/** Set when the rows could not be loaded; rendered above the table. */
		error?: string | null;
		onSetStatus: (ids: string[], status: ReportStatus) => void;
		onMarkRead: (ids: string[]) => void;
		onRefresh: () => void;
		/** Heading shown above the table. */
		title?: string;
		emptyDescription?: string;
	}

	let {
		rows,
		track,
		loading = false,
		error = null,
		onSetStatus,
		onMarkRead,
		onRefresh,
		title = 'Reported Questions',
		emptyDescription = 'Reports appear here when a respondent flags a question during an interview.'
	}: Props = $props();

	/**
	 * Whether a column is the one this queue acts on.
	 *
	 * Both tracks are named for what they are rather than for who is looking —
	 * a report's project review is its project review from either queue — so
	 * the columns are fixed and `track` decides only which is emphasised. It is
	 * read inside these functions rather than at setup, so the component does
	 * not capture a prop before it is reactive.
	 */
	function actedOn(columnId: string): boolean {
		return columnId === (track === 'admin' ? 'admin_status' : 'status');
	}

	/**
	 * The platform's review, where the caller was served one.
	 *
	 * A project member is not: the field is absent from their rows entirely,
	 * so this narrows on its presence rather than assuming it. The parameter
	 * is the union, which is what lets `in` narrow to the admin row.
	 */
	function adminStatus(report: QueueRow): ReportStatus | null {
		return 'admin_status' in report ? report.admin_status : null;
	}

	/** The status this queue acts on, for the unread count and the badge. */
	function acted(report: QueueRow): ReportStatus {
		if (track !== 'admin') return report.status;
		// Falls back to the project status only so the type is total; an admin
		// row always carries its own.
		return adminStatus(report) ?? report.status;
	}

	const helper = createColumnHelper<DataTableFeatures, QueueRow>();

	const baseColumns = helper.columns([
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

	/**
	 * The platform's review track is a column only on the platform's own queue.
	 *
	 * Not merely hidden: a project member is not served the field at all — see
	 * `MessageReportPublic` on the backend — so there would be nothing in it.
	 * Derived rather than built at setup so the prop is read reactively.
	 */
	const adminColumn = helper.accessor((r) => adminStatus(r) ?? '', {
		id: 'admin_status',
		header: 'Platform review',
		sortFn: 'text',
		filterFn: matchesSelection
	});

	// The cast is TanStack's tuple typing, not a claim about the data:
	// `helper.columns` returns a fixed-length tuple, so appending to it loses
	// the shape the table options want. Both elements are column defs over the
	// same row type either way.
	const columns = $derived.by(() =>
		track === 'admin'
			? ([...baseColumns, adminColumn] as unknown as typeof baseColumns)
			: baseColumns
	);

	const searchableColumns = ['project_title', 'question', 'comment', 'pid'];

	const table = createTable({
		features: dataTableFeatures,
		get columns() {
			return columns;
		},
		get data() {
			return rows;
		},
		getRowId: (r) => r.id,
		globalFilterFn: 'includesString',
		getColumnCanGlobalFilter: (column) => searchableColumns.includes(column.id),
		initialState: { pagination: NO_PAGINATION, sorting: [{ id: 'created_at', desc: true }] }
	});

	const columnLabels = $derived({
		created_at: 'Reported',
		project_title: 'Project',
		question: 'Question',
		reason: 'Reason',
		comment: 'Comment',
		status: 'Project review',
		...(track === 'admin' ? { admin_status: 'Platform review' } : {}),
		read_by_me: 'Read',
		pid: 'PID',
		language: 'Language'
	});

	const selectedIds = $derived(table.getSelectedRowIds());

	/** Still open on this track and not yet read by this reviewer. */
	const openUnread = $derived(
		rows.filter((report) => acted(report) === 'open' && !report.read_by_me).length
	);

	const STATUS_CLASS: Record<ReportStatus, string> = {
		resolved: 'bg-green-100 text-green-800',
		dismissed: 'bg-gray-100 text-gray-600',
		open: 'bg-amber-100 text-amber-800'
	};

	const REASON_CLASS: Record<string, string> = {
		offensive: 'bg-red-100 text-red-800',
		inappropriate: 'bg-orange-100 text-orange-800'
	};

	function act(status: ReportStatus) {
		onSetStatus(selectedIds, status);
	}
</script>

<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
	<div class="flex items-baseline gap-3">
		<h2 class="page-title mb-0">{title}</h2>
		{#if openUnread > 0}
			<span class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
				{openUnread} unread
			</span>
		{/if}
	</div>
	<button
		class="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-secondary/40 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
		onclick={onRefresh}
		title="Refresh"
		aria-label="Refresh"
		disabled={loading}
	>
		<i class="fa-solid fa-arrows-rotate {loading ? 'animate-spin' : ''}"></i>
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
	{loading}
	hasLoaded={!loading || rows.length > 0}
	search
	rowLabel="report"
	searchPlaceholder="Search project, question, comment or PID..."
	emptyTitle="No reported questions"
	{emptyDescription}
>
	{#snippet filters()}
		<FacetedFilter title="Reason" column={table.getColumn('reason')!} />
		<!-- Both tracks are filterable; this queue's own is the useful one, but
		     "what has the other reviewer done with it" is a fair question too. -->
		<FacetedFilter title="Project review" column={table.getColumn('status')!} />
		{#if track === 'admin'}
			<FacetedFilter title="Platform review" column={table.getColumn('admin_status')!} />
		{/if}
		<FacetedFilter title="Read" column={table.getColumn('read_by_me')!} />
	{/snippet}

	{#snippet selectionActions()}
		<button
			class="ml-1 flex items-center gap-1.5 rounded px-2 py-0.5 text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
			onclick={() => act('resolved')}
			disabled={loading}
		>
			<i class="fa-solid fa-circle-check text-xs"></i>
			Resolve
		</button>
		<button
			class="flex items-center gap-1.5 rounded px-2 py-0.5 text-gray-700 hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-40"
			onclick={() => act('dismissed')}
			disabled={loading}
		>
			<i class="fa-solid fa-ban text-xs"></i>
			Dismiss
		</button>
		<button
			class="flex items-center gap-1.5 rounded px-2 py-0.5 text-gray-700 hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-40"
			onclick={() => act('open')}
			disabled={loading}
		>
			<i class="fa-solid fa-rotate-left text-xs"></i>
			Reopen
		</button>
		<button
			class="flex items-center gap-1.5 rounded px-2 py-0.5 text-gray-700 hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-40"
			onclick={() => onMarkRead(selectedIds)}
			disabled={loading}
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
				text the respondent never saw.
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
				class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize {REASON_CLASS[
					report.reason
				] ?? 'bg-gray-100 text-gray-700'}"
			>
				{report.reason}
			</span>
		{:else if columnId === 'comment'}
			<span title={report.comment || ''}>
				{#if report.comment}{report.comment}{:else}<span class="text-gray-300">&ndash;</span>{/if}
			</span>
		{:else if columnId === 'status' || columnId === 'admin_status'}
			{@const value = columnId === 'admin_status' ? adminStatus(report) : report.status}
			{#if value === null}
				<span class="text-gray-300">&ndash;</span>
			{:else if actedOn(columnId)}
				<span
					class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize {STATUS_CLASS[
						value
					]}"
				>
					{value}
				</span>
			{:else}
				<!-- The other reviewer's track: shown, but not actionable from here. -->
				<span class="text-xs text-gray-500 capitalize" title="Not changed from this queue">
					{value}
				</span>
			{/if}
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
