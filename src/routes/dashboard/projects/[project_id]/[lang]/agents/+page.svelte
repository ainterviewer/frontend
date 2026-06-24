<script lang="ts">
	import { page } from '$app/state';
	import { Projects } from '$lib/api';
	import type {
		AgentConfigsInput,
		AgentConfigsOutput,
		ProbingAgentConfig,
		ProbingPromptSlots
	} from '$lib/api/types.gen';
	import { untrack } from 'svelte';

	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let saving = $state(false);
	let mode = $state<'basic' | 'advanced'>('basic');
	let agents = $state<AgentConfigsOutput>(untrack(() => data.agents));
	let models = $state<string[]>(untrack(() => data.models));
	let promptDefaults = $state<ProbingPromptSlots>(untrack(() => data.promptDefaults));

	// Editable text mirrors of each prompt slot. List slots use one item per line.
	// Each is seeded with the effective value: the project's overwrite when set,
	// otherwise the default — so the editor always shows what the agent currently uses.
	let personaText = $state('');
	let qualitiesText = $state('');
	let guidelinesText = $state('');
	let instructionsText = $state('');
	let examplesText = $state('');

	function joinLines(items: string[] | null | undefined): string {
		return (items ?? []).join('\n');
	}

	function splitLines(text: string): string[] {
		return text
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
	}

	function arraysEqual(a: string[], b: string[] | null | undefined): boolean {
		if (!b || a.length !== b.length) return false;
		return a.every((value, index) => value === b[index]);
	}

	// Grow a textarea to fit its content so the column expands instead of scrolling.
	// The bound text is passed as the action argument so programmatic changes
	// (e.g. "Reset to default") trigger a resize via the update lifecycle.
	function autoresize(node: HTMLTextAreaElement, _value: string) {
		const resize = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight}px`;
		};
		resize();
		node.addEventListener('input', resize);
		// Recompute on width changes (viewport resize, column layout switch, …)
		// since re-wrapping changes how many lines the content occupies. Guard on
		// width so our own height adjustment doesn't re-trigger the observer.
		let lastWidth = node.clientWidth;
		const observer = new ResizeObserver(() => {
			if (node.clientWidth === lastWidth) return;
			lastWidth = node.clientWidth;
			resize();
		});
		observer.observe(node);
		return {
			update() {
				resize();
			},
			destroy() {
				node.removeEventListener('input', resize);
				observer.disconnect();
			}
		};
	}

	function seedSlotEditors() {
		const slots = agents.probing?.prompt_slots ?? {};
		personaText = slots.persona ?? promptDefaults.persona ?? '';
		qualitiesText = joinLines(slots.question_qualities ?? promptDefaults.question_qualities);
		guidelinesText = joinLines(slots.guidelines ?? promptDefaults.guidelines);
		instructionsText = joinLines(slots.instructions ?? promptDefaults.instructions);
		examplesText = joinLines(agents.probing?.few_shot_examples);
	}

	// Re-seed whenever the loaded data changes (e.g. navigating between languages).
	$effect(() => {
		agents = data.agents;
		models = data.models;
		promptDefaults = data.promptDefaults;
		untrack(seedSlotEditors);
	});

	let projectId = $state(page.params.project_id ?? '');
	let lang = $state(page.params.lang ?? '');

	// The visual agent is excluded everywhere here: it isn't relevant to the
	// current state of the system and its default model differs from the rest.
	const MANAGED_AGENTS = (key: string) => key !== 'visual';

	// The shared model shown by the Basic single picker: the common model when every
	// managed agent uses the same one, otherwise '' (rendered as "---").
	let sharedModel = $derived.by(() => {
		const configs = Object.entries(agents)
			.filter(([key, config]) => MANAGED_AGENTS(key) && config)
			.map(([, config]) => config!);
		if (configs.length === 0) return '';
		const first = configs[0].model;
		return configs.every((c) => c.model === first) ? first : '';
	});

	// The shared model may not be in the fetched list (e.g. a model that was
	// removed since it was configured); include it so the picker can show its name.
	let basicModelOptions = $derived(
		sharedModel && !models.includes(sharedModel) ? [sharedModel, ...models] : models
	);

	// A list slot stores null (stays linked to the default) when it matches the
	// default, otherwise the edited list.
	function listOverwrite(text: string, fallback: string[] | null | undefined): string[] | null {
		const items = splitLines(text);
		return arraysEqual(items, fallback) ? null : items;
	}

	async function saveConfig() {
		saving = true;

		const persona = personaText.trim();
		const slots: ProbingPromptSlots = {
			persona: persona === (promptDefaults.persona ?? '').trim() ? null : persona,
			question_qualities: listOverwrite(qualitiesText, promptDefaults.question_qualities),
			guidelines: listOverwrite(guidelinesText, promptDefaults.guidelines),
			instructions: listOverwrite(instructionsText, promptDefaults.instructions)
		};

		const examples = splitLines(examplesText);

		if (agents.probing) {
			agents.probing.prompt_slots = slots;
			agents.probing.few_shot_examples = examples.length > 0 ? examples : null;
		}

		const res = await Projects.createInterviewAgents({
			path: { project_id: projectId, lang: lang },
			body: agents as AgentConfigsInput
		});

		if (res.error) {
			console.error('Failed to save config', res.error);
			toast.error('Failed to save configuration');
		} else {
			toast.success('Configuration saved');
		}
		saving = false;
	}

	function setAllModels(model: string) {
		if (model === '') return;
		for (const key of Object.keys(agents) as (keyof typeof agents)[]) {
			if (agents[key] && MANAGED_AGENTS(key)) {
				agents[key]!.model = model;
			}
		}
	}

	// --- Advanced: read-only rendered preview of the probing prompts ---------
	let previewSystem = $state('');
	let previewInstruction = $state('');
	let previewLoading = $state(false);
	let previewError = $state(false);

	// Build the probing config from the current (possibly unsaved) editor values so
	// the preview reflects exactly what is on screen.
	function buildProbingBody(): ProbingAgentConfig {
		const examples = splitLines(examplesText);
		return {
			model: agents.probing?.model,
			temperature: agents.probing?.temperature,
			prompt_slots: {
				persona: personaText.trim() || null,
				question_qualities: splitLines(qualitiesText),
				guidelines: splitLines(guidelinesText),
				instructions: splitLines(instructionsText)
			},
			few_shot_examples: examples.length > 0 ? examples : null
		};
	}

	async function refreshPreview() {
		previewLoading = true;
		previewError = false;

		const res = await Projects.previewProbingPrompts({
			path: { project_id: projectId, lang: lang },
			body: buildProbingBody()
		});

		if (res.error || !res.data) {
			console.error('Failed to render prompt preview', res.error);
			previewError = true;
		} else {
			previewSystem = res.data.system;
			previewInstruction = res.data.instruction;
		}
		previewLoading = false;
	}

	// Re-render the preview (debounced) whenever the slots change while in Advanced.
	$effect(() => {
		if (mode !== 'advanced') return;
		// Track the editor values so edits trigger a refresh.
		void personaText;
		void qualitiesText;
		void guidelinesText;
		void instructionsText;
		void examplesText;

		const timer = setTimeout(refreshPreview, 400);
		return () => clearTimeout(timer);
	});
</script>

<h1 class="page-title">Agents</h1>

<p class="mb-4 text-gray-600">
	Configure the agents that are used in the interviews. Sensible defaults are already in place, so
	everything here works out of the box, you don't need to change anything. Adjust these settings
	only if you want to fine-tune how the interview agents behave.
</p>

<div class="space-y-8">
	<section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-6">
			<h3 class="mb-2 text-lg font-medium text-gray-800">Agent Configuration</h3>
			<p class="text-sm text-gray-500">
				{#if mode === 'basic'}
					Choose a single model used by every interview agent. Switch to <strong>Advanced</strong> to
					configure the model and temperature per agent.
				{:else}
					Configure the model and temperature used by each agent individually.
				{/if}
			</p>
		</div>

		{#if mode === 'basic'}
			<div class="w-fit">
				<label for="all-models" class="mb-1 block text-sm font-medium text-gray-700">Model</label>
				<select
					id="all-models"
					onchange={(e) => setAllModels((e.currentTarget as HTMLSelectElement).value)}
					class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					value={sharedModel}
				>
					<option value="">---</option>
					{#each basicModelOptions as model (model)}
						<option value={model}>{model}</option>
					{/each}
				</select>
			</div>
		{:else}
			<div class="w-fit space-y-8">
				<div>
					<label for="all-models-advanced" class="mb-1 block text-sm font-medium text-gray-700"
						>Set all agent models at once</label
					>
					<select
						id="all-models-advanced"
						onchange={(e) => setAllModels((e.currentTarget as HTMLSelectElement).value)}
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						value={sharedModel}
					>
						<option value="">---</option>
						{#each models as model (model)}
							<option value={model}>{model}</option>
						{/each}
					</select>
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
							<label for="reformulation-model" class="mb-1 block text-sm font-medium text-gray-700"
								>Model</label
							>
							<select
								id="reformulation-model"
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
								for="reformulation-temperature"
								class="mb-1 block text-sm font-medium text-gray-700">Temperature</label
							>
							<input
								id="reformulation-temperature"
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
							<label for="guide-model" class="mb-1 block text-sm font-medium text-gray-700"
								>Model</label
							>
							<select
								id="guide-model"
								bind:value={agents.guide!.model}
								class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							>
								{#each models as model (model)}
									<option value={model}>{model}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="guide-temperature" class="mb-1 block text-sm font-medium text-gray-700"
								>Temperature</label
							>
							<input
								id="guide-temperature"
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
			</div>
		{/if}
	</section>

	<section class="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-6">
			<h3 class="mb-2 text-lg font-medium text-gray-800">Probing Prompt</h3>
			<p class="text-sm text-gray-500">
				Customize the editable parts of the probing agent's prompt. Each field is seeded with the
				current default — edit it to overwrite, or use <em>Reset to default</em> to restore it. The surrounding
				structure (interview context, transcript, formatting rules) is managed automatically and always
				included.
			</p>
		</div>

		{#snippet slotInputs()}
			<!-- Persona -->
			<div>
				<div class="mb-2 flex items-center justify-between">
					<label for="slot-persona" class="block font-medium text-gray-700">Persona</label>
					<button
						type="button"
						class="text-sm text-blue-600 hover:underline"
						onclick={() => (personaText = promptDefaults.persona ?? '')}>Reset to default</button
					>
				</div>
				<p class="mb-2 text-sm text-gray-500">
					Who the interviewer is and the role they play. Sets the tone for every probe.
				</p>
				<textarea
					id="slot-persona"
					bind:value={personaText}
					use:autoresize={personaText}
					rows="3"
					class="w-full resize-none overflow-hidden rounded border border-gray-300 bg-white p-2 text-sm"
				></textarea>
			</div>

			<!-- Question qualities -->
			<div>
				<div class="mb-2 flex items-center justify-between">
					<label for="slot-qualities" class="block font-medium text-gray-700"
						>Question qualities</label
					>
					<button
						type="button"
						class="text-sm text-blue-600 hover:underline"
						onclick={() => (qualitiesText = joinLines(promptDefaults.question_qualities))}
						>Reset to default</button
					>
				</div>
				<p class="mb-2 text-sm text-gray-500">
					Qualities every question should have. One per line.
				</p>
				<textarea
					id="slot-qualities"
					bind:value={qualitiesText}
					use:autoresize={qualitiesText}
					rows="8"
					class="w-full resize-none overflow-hidden rounded border border-gray-300 bg-white p-2 font-mono text-sm"
				></textarea>
			</div>

			<!-- Guidelines -->
			<div>
				<div class="mb-2 flex items-center justify-between">
					<label for="slot-guidelines" class="block font-medium text-gray-700"
						>Additional guidelines</label
					>
					<button
						type="button"
						class="text-sm text-blue-600 hover:underline"
						onclick={() => (guidelinesText = joinLines(promptDefaults.guidelines))}
						>Reset to default</button
					>
				</div>
				<p class="mb-2 text-sm text-gray-500">
					General guidance for how the interviewer behaves. One per line.
				</p>
				<textarea
					id="slot-guidelines"
					bind:value={guidelinesText}
					use:autoresize={guidelinesText}
					rows="6"
					class="w-full resize-none overflow-hidden rounded border border-gray-300 bg-white p-2 font-mono text-sm"
				></textarea>
			</div>

			<!-- Instructions -->
			<div>
				<div class="mb-2 flex items-center justify-between">
					<label for="slot-instructions" class="block font-medium text-gray-700"
						>Probing instructions</label
					>
					<button
						type="button"
						class="text-sm text-blue-600 hover:underline"
						onclick={() => (instructionsText = joinLines(promptDefaults.instructions))}
						>Reset to default</button
					>
				</div>
				<p class="mb-2 text-sm text-gray-500">
					Step-by-step instructions used when generating each follow-up question. One per line.
				</p>
				<textarea
					id="slot-instructions"
					bind:value={instructionsText}
					use:autoresize={instructionsText}
					rows="12"
					class="w-full resize-none overflow-hidden rounded border border-gray-300 bg-white p-2 font-mono text-sm"
				></textarea>
			</div>

			<!-- Few-shot examples -->
			<div>
				<div class="mb-2 flex items-center justify-between">
					<label for="slot-examples" class="block font-medium text-gray-700"
						>Example probes (optional)</label
					>
					<button
						type="button"
						class="text-sm text-blue-600 hover:underline"
						onclick={() => (examplesText = '')}>Clear</button
					>
				</div>
				<p class="mb-2 text-sm text-gray-500">
					Examples of good probing questions to guide the model. One per line. Leave empty for none.
				</p>
				<textarea
					id="slot-examples"
					bind:value={examplesText}
					use:autoresize={examplesText}
					rows="4"
					class="w-full resize-none overflow-hidden rounded border border-gray-300 bg-white p-2 font-mono text-sm"
				></textarea>
			</div>
		{/snippet}

		{#snippet promptPreview()}
			<div class="mb-2 flex items-center justify-between">
				<h4 class="font-medium text-gray-700">Rendered prompt preview</h4>
				{#if previewLoading}
					<span class="text-sm text-gray-400"
						><i class="fas fa-spinner fa-spin"></i> Rendering…</span
					>
				{/if}
			</div>
			<p class="mb-4 text-sm text-gray-500">
				The probing prompts assembled from the values on the left. Interview-time context
				(transcript, framing) and optional segments (suggested probes, translation) are shown as
				labelled placeholders since they are only filled in during an interview.
			</p>

			{#if previewError}
				<p class="text-sm text-red-600">Failed to render the preview.</p>
			{:else}
				<div class="space-y-6">
					<div>
						<div class="mb-1 text-sm font-medium text-gray-600">System prompt</div>
						<pre
							class="rounded border border-gray-200 bg-gray-50 p-3 font-mono text-xs whitespace-pre-wrap text-gray-800">{previewSystem}</pre>
					</div>
					<div>
						<div class="mb-1 text-sm font-medium text-gray-600">Instruction prompt</div>
						<pre
							class="rounded border border-gray-200 bg-gray-50 p-3 font-mono text-xs whitespace-pre-wrap text-gray-800">{previewInstruction}</pre>
					</div>
				</div>
			{/if}
		{/snippet}

		{#if mode === 'advanced'}
			<div class="grid grid-cols-1 gap-8 xl:grid-cols-2">
				<div class="space-y-8">{@render slotInputs()}</div>
				<div class="space-y-6">{@render promptPreview()}</div>
			</div>
		{:else}
			<div class="space-y-8">{@render slotInputs()}</div>
		{/if}
	</section>

	<div
		class="sticky bottom-0 ml-auto flex w-fit items-center gap-4 rounded-full border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur"
	>
		<div class="flex rounded-full bg-gray-100 p-1">
			<button
				type="button"
				onclick={() => (mode = 'basic')}
				class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors {mode === 'basic'
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-500 hover:text-gray-700'}"
			>
				Basic
			</button>
			<button
				type="button"
				onclick={() => (mode = 'advanced')}
				class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors {mode === 'advanced'
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-500 hover:text-gray-700'}"
			>
				Advanced
			</button>
		</div>

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
