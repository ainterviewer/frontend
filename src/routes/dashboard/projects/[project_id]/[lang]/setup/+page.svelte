<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Projects } from '$lib/api';
	import type { ExternalParam, InterviewConfig, ProbingStrategy } from '$lib/api/types.gen';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let projectId = $derived(page.params.project_id);
	let lang = $derived(page.params.lang);

	// Advanced settings state
	let advancedOpen = $state(false);
	let savingParams = $state(false);

	// Interview config state
	const probingOptions: { value: ProbingStrategy; label: string }[] = [
		{ value: 'standard', label: 'Standard' },
		{ value: 'dice_master_to_one_probe', label: 'DICE: master to one probe' },
		{ value: 'dice_ensemble_to_master_probe', label: 'DICE: ensemble to master probe' },
		{ value: 'dice_master_to_ensemble_to_one_probe', label: 'DICE: master to ensemble to one probe' }
	];

	const configToggles: { key: 'with_consent' | 'with_welcome' | 'with_audio'; label: string; description: string }[] = [
		{
			key: 'with_consent',
			label: 'Ask for consent',
			description: 'Show the consent message users must accept before starting the interview.'
		},
		{
			key: 'with_welcome',
			label: 'Show welcome message',
			description: 'Display the welcome message before the interview begins.'
		},
		{
			key: 'with_audio',
			label: 'Allow audio answers',
			description:
				'Let respondents record answers as audio messages, which are transcribed before being sent to the AInterviewer.'
		}
	];

	let savingConfig = $state(false);
	let config: InterviewConfig = $state({});

	$effect(() => {
		config = structuredClone(data.config ?? {});
	});

	function toggleProbing(strategy: ProbingStrategy, checked: boolean) {
		const current = config.probing_strategy ?? [];
		if (checked) {
			if (!current.includes(strategy)) config.probing_strategy = [...current, strategy];
		} else {
			config.probing_strategy = current.filter((s) => s !== strategy);
		}
	}

	async function saveConfig() {
		savingConfig = true;
		const { error } = await Projects.createInterviewConfig({
			path: { project_id: projectId },
			body: config
		});
		if (error) {
			console.error(error);
			toast.error('Failed to save interview configuration');
		} else {
			await invalidateAll();
			toast.success('Interview configuration saved');
		}
		savingConfig = false;
	}

	function createEmptyParam(): ExternalParam {
		return {
			name: '',
			type: 'str',
			required: false,
			default: null,
			options: null,
			description: null
		};
	}

	let externalParams: ExternalParam[] = $state([]);

	$effect(() => {
		externalParams = structuredClone(data.project?.external_params ?? []);
	});

	const paramCount = $derived(externalParams.length);

	function addParam() {
		externalParams.push(createEmptyParam());
	}

	function removeParam(index: number) {
		externalParams.splice(index, 1);
	}

	async function saveExternalParams() {
		savingParams = true;
		const { error } = await Projects.updateExternalParams({
			path: { project_id: projectId },
			body: { params: externalParams }
		});
		if (error) {
			console.error(error);
			toast.error('Failed to save external parameters');
		} else {
			await invalidateAll();
			toast.success('External parameters saved');
		}
		savingParams = false;
	}

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
		{#each steps as step (step.number)}
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

	<!-- Advanced Settings -->
	<div class="mt-8 rounded-lg border border-gray-200 bg-white shadow-sm">
		<button
			type="button"
			onclick={() => (advancedOpen = !advancedOpen)}
			class="flex w-full items-center justify-between p-5 text-left"
		>
			<div class="flex items-center gap-3">
				<i class="fa-solid fa-gear text-gray-500"></i>
				<h2 class="text-lg font-semibold text-gray-900">Advanced Settings</h2>
				{#if paramCount > 0}
					<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
						{paramCount}
						{paramCount === 1 ? 'param' : 'params'}
					</span>
				{/if}
			</div>
			<i
				class="fa-solid fa-chevron-down text-gray-400 transition-transform duration-200"
				class:rotate-180={advancedOpen}
			></i>
		</button>

		{#if advancedOpen}
			<div class="border-t border-gray-200 p-6">
				<!-- Interview configuration -->
				<h3 class="text-sm font-semibold text-gray-900">Interview configuration</h3>
				<p class="mt-1 mb-4 text-sm text-gray-600">
					Control which features are enabled for this interview.
				</p>

				<div class="space-y-3">
					{#each configToggles as toggle (toggle.key)}
						<label class="flex items-start gap-3">
							<input
								type="checkbox"
								bind:checked={config[toggle.key]}
								class="mt-0.5 rounded border-gray-300 text-primary focus:ring-blue-500"
							/>
							<span class="min-w-0">
								<span class="block text-sm font-medium text-gray-700">{toggle.label}</span>
								<span class="block text-xs text-gray-500">{toggle.description}</span>
							</span>
						</label>
					{/each}
				</div>

				<div class="mt-5">
					<span class="block text-sm font-medium text-gray-700">Probing strategy</span>
					<p class="mb-2 text-xs text-gray-500">
						Select which probing strategies are available for this interview.
					</p>
					<div class="space-y-2">
						{#each probingOptions as option (option.value)}
							<label class="flex items-center gap-2 text-sm text-gray-700">
								<input
									type="checkbox"
									checked={config.probing_strategy?.includes(option.value) ?? false}
									onchange={(e) => toggleProbing(option.value, e.currentTarget.checked)}
									class="rounded border-gray-300 text-primary focus:ring-blue-500"
								/>
								{option.label}
							</label>
						{/each}
					</div>
				</div>

				<div class="mt-4 flex justify-end">
					<button
						type="button"
						onclick={saveConfig}
						disabled={savingConfig}
						class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dark disabled:cursor-not-allowed disabled:opacity-50"
					>
						Save configuration
					</button>
				</div>

				<hr class="my-6 border-gray-200" />

				<h3 class="text-sm font-semibold text-gray-900">External parameters</h3>
				<p class="mt-1 mb-4 text-sm text-gray-600">
					Define URL query parameters that will be validated and captured when respondents access
					the interview link.
				</p>

				{#if externalParams.length > 0}
					<div class="space-y-4">
						{#each externalParams as param, i (param)}
							<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
								<div class="mb-3 flex items-center justify-between">
									<span class="text-sm font-medium text-gray-700">Parameter {i + 1}</span>
									<button
										type="button"
										onclick={() => removeParam(i)}
										class="rounded p-1 text-gray-400 transition-colors hover:text-red-500"
										title="Remove parameter"
									>
										<i class="fa-solid fa-trash-can text-sm"></i>
									</button>
								</div>

								<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
									<!-- Name -->
									<div>
										<label for="param-name-{i}" class="mb-1 block text-xs font-medium text-gray-600"
											>Name *</label
										>
										<input
											id="param-name-{i}"
											type="text"
											bind:value={param.name}
											placeholder="e.g. respondent_id"
											required
											class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
										/>
									</div>

									<!-- Type -->
									<div>
										<label for="param-type-{i}" class="mb-1 block text-xs font-medium text-gray-600"
											>Type</label
										>
										<select
											id="param-type-{i}"
											bind:value={param.type}
											class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
										>
											<option value="str">String</option>
											<option value="int">Integer</option>
											<option value="float">Float</option>
											<option value="bool">Boolean</option>
											<option value="enum">Enum</option>
										</select>
									</div>

									<!-- Default -->
									<div>
										<label
											for="param-default-{i}"
											class="mb-1 block text-xs font-medium text-gray-600">Default</label
										>
										<input
											id="param-default-{i}"
											type="text"
											value={param.default ?? ''}
											oninput={(e) => {
												const val = e.currentTarget.value;
												param.default = val === '' ? null : val;
											}}
											placeholder="Optional"
											class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
										/>
									</div>

									<!-- Description -->
									<div class="sm:col-span-2">
										<label for="param-desc-{i}" class="mb-1 block text-xs font-medium text-gray-600"
											>Description</label
										>
										<input
											id="param-desc-{i}"
											type="text"
											value={param.description ?? ''}
											oninput={(e) => {
												const val = e.currentTarget.value;
												param.description = val === '' ? null : val;
											}}
											placeholder="What is this parameter for?"
											class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
										/>
									</div>

									<!-- Required -->
									<div class="flex items-end">
										<label class="flex items-center gap-2 text-sm text-gray-700">
											<input
												type="checkbox"
												bind:checked={param.required}
												class="rounded border-gray-300 text-primary focus:ring-blue-500"
											/>
											Required
										</label>
									</div>
								</div>

								<!-- Options (only for enum type) -->
								{#if param.type === 'enum'}
									<div class="mt-3">
										<label
											for="param-options-{i}"
											class="mb-1 block text-xs font-medium text-gray-600"
											>Options (comma-separated)</label
										>
										<input
											id="param-options-{i}"
											type="text"
											value={param.options?.join(', ') ?? ''}
											oninput={(e) => {
												const val = e.currentTarget.value;
												param.options =
													val.trim() === ''
														? null
														: val
																.split(',')
																.map((s) => s.trim())
																.filter(Boolean);
											}}
											placeholder="e.g. option1, option2, option3"
											class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
										/>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<div class="rounded-lg border border-dashed border-gray-300 p-6 text-center">
						<i class="fa-solid fa-link text-2xl text-gray-300"></i>
						<p class="mt-2 text-sm text-gray-500">No external parameters configured.</p>
					</div>
				{/if}

				<div class="mt-4 flex items-center justify-between">
					<button
						type="button"
						onclick={addParam}
						class="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<i class="fa-solid fa-plus"></i>
						Add parameter
					</button>

					<button
						type="button"
						onclick={saveExternalParams}
						disabled={savingParams}
						class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dark disabled:cursor-not-allowed disabled:opacity-50"
					>
						Save
					</button>
				</div>
			</div>
		{/if}
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
					href={resolve(`/dashboard/projects/${projectId}/${lang}/tests/simulations`)}
					class="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
				>
					<i class="fa-solid fa-flask-vial"></i>
					Run tests
				</a>
				<a
					href={resolve(`/dashboard/projects/${projectId}/${lang}/distribution`)}
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
				Complete all setup steps to unlock testing and distribution.
			</p>
		</div>
	{/if}
</div>
