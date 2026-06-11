<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { Projects } from '$lib/api';
	import type { PromptsUpdateRequest, AgentConfigs } from '$lib/api/types.gen';

	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let saving = $state(false);
	let agents = $state<AgentConfigs>(untrack(() => data.agents));
	let prompts = $state<Record<string, any>>(untrack(() => data.prompts as Record<string, any>));
	let models = $state<string[]>(untrack(() => data.models));
	let promptsContainer: HTMLDivElement;

	$effect(() => {
		agents = data.agents;
		models = data.models;
		prompts = data.prompts as Record<string, any>;
	});

	$effect(() => {
		if (prompts && promptsContainer) {
			highlightText();
		}
	});

	let projectId = $state(page.params.project_id ?? '');
	let lang = $state(page.params.lang ?? '');

	async function saveConfig() {
		saving = true;
		const [agentsRes, promptsRes] = await Promise.all([
			Projects.createInterviewAgents({
				path: { project_id: projectId, lang: lang },
				body: agents as AgentConfigs
			}),
			Projects.createPrompts({
				path: { project_id: projectId, lang: lang },
				body: prompts as PromptsUpdateRequest
			})
		]);
		if (agentsRes.error || promptsRes.error) {
			console.error('Failed to save config', agentsRes.error || promptsRes.error);
			toast.error('Failed to save configuration');
		} else {
			toast.success('Configuration saved');
		}
		saving = false;
	}

	function replaceTextNodes(node: Node, regex: RegExp, color: string, brackets: string) {
		if (node.nodeType === 3) {
			// If it's a text node
			let value = node.nodeValue || '';
			if (regex.test(value)) {
				const newNode = document.createElement('span');
				newNode.innerHTML = value.replace(regex, (match, innerText) => {
					let innerHTML = '';
					if (brackets === 'single') {
						innerHTML = `\{<span class="highlight-syntax ${color}">${innerText}</span>\}`;
					} else if (brackets === 'double') {
						innerHTML = `\{\{<span class="highlight-syntax ${color}">${innerText}</span>\}\}`;
					}
					return innerHTML;
				});
				node.parentNode?.replaceChild(newNode, node);
			}
		} else {
			node.childNodes.forEach((child) => replaceTextNodes(child, regex, color, brackets));
		}
	}

	function highlightText() {
		if (!promptsContainer) return;

		// Regular expression to match text enclosed in double curly braces
		var regexDouble = RegExp(`\{\{(\.*?)\}\}`, 'g');
		replaceTextNodes(promptsContainer, regexDouble, 'blue', 'double');

		// Regular expression to match text enclosed in single curly braces
		var regexSingle = RegExp(`\{(\.*?)\}`, 'g');
		replaceTextNodes(promptsContainer, regexSingle, 'pink', 'single');
	}

	function setAllModels(model: string) {
		if (model === '') return;
		for (const key of Object.keys(agents) as (keyof typeof agents)[]) {
			if (agents[key]) {
				agents[key]!.model = model;
			}
		}
	}

	function updatePromptValue(event: FocusEvent, agentKey: string, promptKey: string) {
		const element = event.target as HTMLElement;
		const plainText = element.innerText;

		if (prompts[agentKey]) {
			prompts[agentKey][promptKey] = plainText;
			highlightText();
		}
	}
</script>

<h1 class="page-title">Agents</h1>

<p class="mb-6 text-gray-600">Configure the agents that are used in the interviews.</p>

<div class="space-y-8">
	<section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-6">
			<h3 class="mb-2 text-lg font-medium text-gray-800">Agent Configuration</h3>
			<p class="text-sm text-gray-500">
				In this section, you can configure the models and their respective parameters that are used
				by the agents to conduct the interviews.
			</p>
		</div>

		<div class="w-fit space-y-8">
			<p class="mb-2">
				Change the individual agent models in the sections below, or change all here:
			</p>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<select
					id="all-models"
					onchange={(e) => setAllModels((e.currentTarget as HTMLSelectElement).value)}
					class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					value=""
				>
					<option value="">---</option>
					{#each models as model (model)}
						<option value={model}>{model}</option>
					{/each}
				</select>
				<div></div>
			</div>
			<!-- Probing Agent -->
			<div class="border-b border-gray-100 pb-6">
				<h4 class="mb-4 font-medium text-gray-700">Probing Agent</h4>
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div>
						<label for="probing-model" class="mb-1 block text-sm font-medium text-gray-700"
							>Model</label
						>
						<select
							id="probing-model"
							bind:value={agents.probing!.model}
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						>
							{#each models as model (model)}
								<option value={model}>{model}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="probing-temperature" class="mb-1 block text-sm font-medium text-gray-700"
							>Temperature</label
						>
						<input
							id="probing-temperature"
							type="number"
							step="0.1"
							min="0"
							max="1"
							bind:value={agents.probing!.temperature}
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						/>
					</div>
				</div>
			</div>

			<!-- Classification Agent -->
			<div class="border-b border-gray-100 pb-6">
				<h4 class="mb-4 font-medium text-gray-700">Classification Agent</h4>
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div>
						<label for="classification-model" class="mb-1 block text-sm font-medium text-gray-700"
							>Model</label
						>
						<select
							id="classification-model"
							bind:value={agents.classification!.model}
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						>
							{#each models as model (model)}
								<option value={model}>{model}</option>
							{/each}
						</select>
					</div>
					<div>
						<label
							for="classification-temperature"
							class="mb-1 block text-sm font-medium text-gray-700">Temperature</label
						>
						<input
							id="classification-temperature"
							type="number"
							step="0.1"
							min="0"
							max="1"
							bind:value={agents.classification!.temperature}
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						/>
					</div>
				</div>
			</div>

			<!-- Reformulation Agent -->
			<div class="border-b border-gray-100 pb-6">
				<h4 class="mb-4 font-medium text-gray-700">Reformulation Agent</h4>
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div>
						<label for="classification-model" class="mb-1 block text-sm font-medium text-gray-700"
							>Model</label
						>
						<select
							id="classification-model"
							bind:value={agents.reformulation!.model}
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						>
							{#each models as model (model)}
								<option value={model}>{model}</option>
							{/each}
						</select>
					</div>
					<div>
						<label
							for="classification-temperature"
							class="mb-1 block text-sm font-medium text-gray-700">Temperature</label
						>
						<input
							id="classification-temperature"
							type="number"
							step="0.1"
							min="0"
							max="1"
							bind:value={agents.reformulation!.temperature}
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						/>
					</div>
				</div>
			</div>

			<!-- Guide Agent -->
			<div class="border-b border-gray-100 pb-6">
				<h4 class="mb-4 font-medium text-gray-700">Guide Agent</h4>
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div>
						<label for="classification-model" class="mb-1 block text-sm font-medium text-gray-700"
							>Model</label
						>
						<select
							id="classification-model"
							bind:value={agents.guide!.model}
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						>
							{#each models as model (model)}
								<option value={model}>{model}</option>
							{/each}
						</select>
					</div>
					<div>
						<label
							for="classification-temperature"
							class="mb-1 block text-sm font-medium text-gray-700">Temperature</label
						>
						<input
							id="classification-temperature"
							type="number"
							step="0.1"
							min="0"
							max="1"
							bind:value={agents.guide!.temperature}
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						/>
					</div>
				</div>
			</div>

			<!-- Security Agent -->
			<div class="hidden border-b border-gray-100 pb-6">
				<div class="mb-4 flex items-center justify-between">
					<h4 class="font-medium text-gray-700">Security Agent</h4>
					<div class="flex items-center">
						<input
							type="checkbox"
							id="security-include"
							bind:checked={agents.security!.include}
							class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<label for="security-include" class="ml-2 block text-sm text-gray-900">Include</label>
					</div>
				</div>

				{#if agents.security!.include}
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div>
							<label for="security-model" class="mb-1 block text-sm font-medium text-gray-700"
								>Model</label
							>
							<select
								id="security-model"
								bind:value={agents.security!.model}
								class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							>
								{#each models as model (model)}
									<option value={model}>{model}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="security-temperature" class="mb-1 block text-sm font-medium text-gray-700"
								>Temperature</label
							>
							<input
								id="security-temperature"
								type="number"
								step="0.1"
								min="0"
								max="1"
								bind:value={agents.security!.temperature}
								class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							/>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<section class="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-6">
			<h3 class="mb-2 text-lg font-medium text-gray-800">Prompts</h3>
			<p class="text-sm text-gray-500">Customize the prompts used by the agents.</p>
		</div>

		<div bind:this={promptsContainer} class="space-y-8">
			{#if prompts}
				{#each Object.entries(prompts) as [agentKey, agentData] (agentKey)}
					{#if ['probing_agent'].includes(agentKey) && typeof agentData === 'object'}
						<div class="rounded border border-gray-200 bg-gray-50 p-4">
							<h3 class="mb-4 border-b border-gray-300 pb-2 font-medium text-gray-700 uppercase">
								{agentKey.replace(/_/g, ' ')}
							</h3>

							{#each Object.entries(agentData) as [promptKey, promptValue] (promptKey)}
								{#if typeof promptValue === 'string'}
									<div class="mb-6">
										<label
											for={`${agentKey}.${promptKey}`}
											class="mb-2 block font-medium text-gray-700 capitalize"
										>
											{promptKey.replace(/_/g, ' ')}:
										</label>
										<!-- svelte-ignore a11y_role_has_required_aria_props -->
										<div
											id={`${agentKey}.${promptKey}`}
											contenteditable="true"
											class="prompt-template-textarea w-full rounded border border-gray-300 bg-white p-2 text-sm"
											onblur={(e) => updatePromptValue(e, agentKey, promptKey)}
										>
											{@html promptValue.replace(/\n/g, '<br>')}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				{/each}
			{/if}
		</div>
	</section>

	<div
		class="sticky bottom-0 ml-auto flex w-fit gap-4 rounded-full border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur"
	>
		<button
			onclick={saveConfig}
			disabled={saving}
			class="flex items-center gap-2 rounded-full bg-primary px-6 py-2 font-medium text-white shadow-sm hover:bg-dark disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if saving}
				<i class="fas fa-spinner fa-spin"></i> Saving...
			{:else}
				<i class="fa-solid fa-floppy-disk"></i> Save Configuration
			{/if}
		</button>
	</div>
</div>

<style>
	:global(.highlight-syntax) {
		background-clip: text;
		display: inline-block;
	}
	:global(.blue) {
		color: #2f2be2;
	}
	:global(.pink) {
		color: #df2981;
	}
	.prompt-template-textarea {
		min-height: 100px;
		line-height: 1.5;
		overflow-y: auto;
		resize: vertical;
		white-space: pre-wrap;
		word-wrap: break-word;
	}
</style>
