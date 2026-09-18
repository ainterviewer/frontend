<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Admin } from '$lib/api';
	import type { MessageReportRowPublic, ReportStatus } from '$lib/api/types.gen';
	import ReportQueue from '$lib/components/reports/ReportQueue.svelte';
	import { errorMessage } from '$lib/utils/errors';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	/**
	 * Every question a respondent has reported, across all projects.
	 *
	 * This page acts on the *platform* track only. Each project has its own
	 * queue over the same rows — `/dashboard/reports` — and clearing a report
	 * here does not clear it there: an owner deciding to reword a question and
	 * the platform reviewing it for safety are different judgements, and
	 * neither should silently stand in for the other.
	 */

	let { data }: { data: PageData } = $props();

	let reports = $derived(data.reports as MessageReportRowPublic[]);
	let isLoading = $state(false);
	let error = $derived<string | null>(data.error);

	async function reload() {
		if (isLoading) return;
		isLoading = true;
		error = null;
		try {
			await invalidateAll();
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

	async function setStatus(ids: string[], status: ReportStatus) {
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

	async function markRead(ids: string[]) {
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

<ReportQueue
	rows={reports}
	track="admin"
	loading={isLoading}
	{error}
	onSetStatus={setStatus}
	onMarkRead={markRead}
	onRefresh={reload}
	emptyDescription="Reports from every project appear here when a respondent flags a question."
/>
