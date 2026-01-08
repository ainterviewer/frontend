<script lang="ts">
	import { page } from '$app/state';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let projectId = $derived(page.params.project_id);
	let lang = $derived(page.params.lang);

	const steps = $derived([
		{
			number: 1,
			title: 'Consent',
			description: 'Configure the consent message users must accept before starting the interview.',
			href: `/dashboard/projects/${projectId}/${lang}/setup/consent`,
			icon: 'fa-solid fa-file-signature',
			isConfigured: !!(data.consent?.title || data.consent?.text),
			preview: data.consent?.title || null
		},
		{
			number: 2,
			title: 'Welcome',
			description:
				'Set up the welcome message, video, and contact information shown before the interview begins.',
			href: `/dashboard/projects/${projectId}/${lang}/setup/welcome`,
			icon: 'fa-solid fa-handshake',
			isConfigured: !!(data.welcome?.title || data.welcome?.text),
			preview: data.welcome?.title || null
		},
		{
			number: 3,
			title: 'Interview Guide',
			description:
				'Create the interview structure with framing, introduction, questions, and outro.',
			href: `/dashboard/projects/${projectId}/${lang}/setup/guide`,
			icon: 'fa-solid fa-clipboard-question',
			isConfigured: !!(
				data.guide?.introduction ||
				(data.guide?.question_sections && data.guide.question_sections.length > 0)
			),
			preview: data.guide?.introduction
				? data.guide.introduction.slice(0, 60) + (data.guide.introduction.length > 60 ? '...' : '')
				: null
		}
	]);

	const completedCount = $derived(steps.filter((s) => s.isConfigured).length);
	const progressPercent = $derived(Math.round((completedCount / steps.length) * 100));
</script>

<div class="max-w-4xl">
	<h1 class="page-title">Setup</h1>
	<p class="mt-2 text-gray-600">
		Configure your interview in three steps. Complete each section to prepare your interview for
		distribution.
	</p>

	<!-- Progress indicator -->
	<div class="mt-6 mb-8">
		<div class="mb-2 flex items-center justify-between text-sm">
			<span class="font-medium text-gray-700">{completedCount} of {steps.length} completed</span>
			<span class="text-gray-500">{progressPercent}%</span>
		</div>
		<div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
			<div
				class="h-full rounded-full bg-primary transition-all duration-300"
				style="width: {progressPercent}%"
			></div>
		</div>
	</div>

	<!-- Steps -->
	<div class="space-y-4">
		{#each steps as step}
			<a
				href={step.href}
				class="group flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
			>
				<!-- Step number / status -->
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors"
					class:bg-primary={step.isConfigured}
					class:text-white={step.isConfigured}
					class:bg-gray-100={!step.isConfigured}
					class:text-gray-500={!step.isConfigured}
				>
					{#if step.isConfigured}
						<i class="fa-solid fa-check"></i>
					{:else}
						<span class="text-sm font-semibold">{step.number}</span>
					{/if}
				</div>

				<!-- Content -->
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<i class="{step.icon} text-gray-500"></i>
						<h3 class="font-semibold text-gray-900">{step.title}</h3>
						{#if step.isConfigured}
							<span
								class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
							>
								Configured
							</span>
						{:else}
							<span
								class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
							>
								Not configured
							</span>
						{/if}
					</div>
					<p class="mt-1 text-sm text-gray-600">{step.description}</p>
					{#if step.preview}
						<p class="mt-2 truncate text-sm text-gray-400 italic">"{step.preview}"</p>
					{/if}
				</div>

				<!-- Arrow -->
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center text-gray-300 transition-colors group-hover:text-primary"
				>
					<i class="fa-solid fa-chevron-right"></i>
				</div>
			</a>
		{/each}
	</div>

	<!-- Quick actions -->
	{#if completedCount === steps.length}
		<div class="mt-8 rounded-lg border border-green-200 bg-green-50 p-4">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
					<i class="fa-solid fa-circle-check text-lg text-green-600"></i>
				</div>
				<div>
					<h3 class="font-semibold text-green-800">Setup complete!</h3>
					<p class="text-sm text-green-700">
						Your interview is ready. You can now test it or start distributing.
					</p>
				</div>
			</div>
			<div class="mt-4 flex gap-3">
				<a
					href="/dashboard/projects/{projectId}/{lang}/tests"
					class="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
				>
					<i class="fa-solid fa-flask-vial"></i>
					Run tests
				</a>
				<a
					href="/dashboard/projects/{projectId}/{lang}/distribution"
					class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dark"
				>
					<i class="fa-solid fa-paper-plane"></i>
					Distribute
				</a>
			</div>
		</div>
	{:else}
		<div class="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4">
			<p class="text-sm text-gray-600">
				<i class="fa-solid fa-circle-info mr-2 text-gray-400"></i>
				Complete all setup steps to unlock distribution and testing.
			</p>
		</div>
	{/if}
</div>
