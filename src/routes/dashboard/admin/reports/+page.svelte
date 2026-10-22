<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { Admin } from '$lib/api';
	import type { ReportStatus } from '$lib/api/types.gen';
	import ReportQueue from '$lib/components/reports/ReportQueue.svelte';
	import { toastApiError } from '$lib/utils/toast';

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

	let reports = $derived(data.reports);
	let isLoading = $state(false);

	/** Rerun the load. Unguarded, for an action that already holds `isLoading`. */
	async function refresh() {
		await invalidateAll();
	}

	async function reload() {
		if (isLoading) return;
		isLoading = true;
		try {
			await refresh();
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
			toast.error('Please select one or more reports');
			return;
		}

		isLoading = true;
		try {
			const response = await Admin.resolveReports({ body: { ids, status } });
			if (response.error) throw response.error;
			await refresh();
			toast.success(`Reports ${STATUS_VERB[status]}`);
		} catch (e) {
			toastApiError(e, 'Failed to update reports');
		} finally {
			isLoading = false;
		}
	}

	async function markRead(ids: string[]) {
		if (ids.length === 0) {
			toast.error('Please select one or more reports');
			return;
		}

		isLoading = true;
		try {
			const response = await Admin.markReportsRead({ body: { ids } });
			if (response.error) throw response.error;
			await refresh();
			toast.success('Reports marked as read');
		} catch (e) {
			toastApiError(e, 'Failed to mark reports as read');
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>AInterviewer - Flagged</title>
</svelte:head>

<ReportQueue
	rows={reports}
	track="admin"
	loading={isLoading}
	onSetStatus={setStatus}
	onMarkRead={markRead}
	onRefresh={reload}
	emptyDescription="Messages from every project appear here when a respondent reports a question or the safety check intervenes."
/>
