<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Reports } from '$lib/api';
	import type { MessageReportRowPublic, ReportStatus } from '$lib/api/types.gen';
	import ReportQueue from '$lib/components/reports/ReportQueue.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { mainSidebarItems } from '$lib/config/sidebar';
	import { errorMessage } from '$lib/utils/errors';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	/**
	 * The questions respondents have reported, across the user's own projects.
	 *
	 * This is where the account-menu badge points, and it is counted the same
	 * way: a member has reports in several projects at once, so a queue scoped
	 * to one of them could never be what the badge means.
	 *
	 * It acts on the *project* track. The platform has its own review of the
	 * same rows at `/dashboard/admin/reports`, and resolving here does not
	 * clear that one — rewording a question and reviewing it for safety are
	 * different judgements.
	 *
	 * The write endpoints are project-scoped (the role check needs a project in
	 * the path), so a selection spanning projects is sent as one call per
	 * project. Marking read is not batched the same way for a reason worth
	 * knowing: it is per-project too.
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

	/**
	 * The selected reports grouped by the project they belong to.
	 *
	 * Every write here is authorised by a project in the path, so a selection
	 * that spans two projects is two calls. Grouping rather than refusing:
	 * the whole point of this page is that it is not scoped to one project.
	 */
	function byProject(ids: string[]): Record<string, string[]> {
		const groups: Record<string, string[]> = {};
		for (const id of ids) {
			const report = reports.find((r) => r.id === id);
			if (!report) continue;
			(groups[report.project_id] ??= []).push(id);
		}
		return groups;
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
			for (const [project_id, projectIds] of Object.entries(byProject(ids))) {
				const response = await Reports.resolveProjectReports({
					path: { project_id },
					body: { ids: projectIds, status }
				});
				if (response.error) throw new Error(String(response.error));
			}
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
			for (const [project_id, projectIds] of Object.entries(byProject(ids))) {
				const response = await Reports.markProjectReportsRead({
					path: { project_id },
					body: { ids: projectIds }
				});
				if (response.error) throw new Error(String(response.error));
			}
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

<Sidebar items={mainSidebarItems} />
<ReportQueue
	rows={reports}
	track="owner"
	loading={isLoading}
	{error}
	onSetStatus={setStatus}
	onMarkRead={markRead}
	onRefresh={reload}
	emptyDescription="Reports appear here when a respondent flags a question in one of your projects."
/>
