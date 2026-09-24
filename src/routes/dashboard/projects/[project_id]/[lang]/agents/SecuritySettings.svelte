<script lang="ts">
	import type { SecurityAction, SecurityConfig, SecurityPolicy } from '$lib/api';

	import { ACTION_LABELS, newDecision, policyErrors } from './securityPolicy';

	interface Props {
		/** Edited in place; saved with the rest of the agent configuration. */
		security: SecurityConfig;
		models: string[];
		mode: 'basic' | 'advanced';
		defaultPolicy: SecurityPolicy;
	}

	let { security = $bindable(), models, mode, defaultPolicy }: Props = $props();

	const errors = $derived(security.policy ? policyErrors(security.policy) : null);

	function addDecision() {
		security.policy ??= { decisions: [] };
		const actionText = defaultPolicy.decisions[0]?.action_text ?? '';
		security.policy.decisions.push(newDecision(security.policy, actionText));
	}

	function removeDecision(index: number) {
		security.policy?.decisions.splice(index, 1);
	}

	function resetPolicy() {
		security.policy = $state.snapshot(defaultPolicy);
	}

	const inputClass =
		'w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-primary focus:ring-primary';
</script>

<section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
	<div class="mb-6">
		<h3 class="mb-2 text-lg font-medium text-gray-800">Safety Check</h3>
		<p class="text-sm text-gray-500">
			After every answer, a separate agent reads the question so far and estimates, for each
			decision below, how likely its question is to apply to the respondent. A decision whose
			estimate reaches its threshold is acted on, and the respondent is shown its message in a
			pop-up. When several trigger at once, only the most drastic is acted on.
		</p>
	</div>

	<label class="flex w-fit cursor-pointer items-center gap-3">
		<input
			type="checkbox"
			bind:checked={security.include}
			class="rounded border-gray-300 text-primary focus:ring-primary"
		/>
		<span class="font-medium text-gray-700">Run the safety check during interviews</span>
	</label>

	{#if mode === 'advanced'}
		<div class="mt-6 grid w-fit grid-cols-1 gap-6 md:grid-cols-2">
			<div>
				<label for="security-model" class="mb-1 block text-sm font-medium text-gray-700"
					>Model</label
				>
				<select id="security-model" bind:value={security.model} class={inputClass}>
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
					bind:value={security.temperature}
					class={inputClass}
				/>
			</div>
		</div>
	{/if}

	{#if security.policy}
		<div class="mt-8">
			<div class="mb-3 flex items-center justify-between">
				<h4 class="font-medium text-gray-700">Decisions</h4>
				<button type="button" class="text-sm text-blue-600 hover:underline" onclick={resetPolicy}
					>Reset to default</button
				>
			</div>

			<div class="space-y-4" class:opacity-60={!security.include}>
				{#each security.policy.decisions as decision, i (i)}
					{@const problems = errors?.decisions.get(i)}
					<fieldset class="rounded-md border border-gray-200 p-4">
						<legend class="sr-only">Decision {decision.name}</legend>
						<div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr_8rem_16rem]">
							<div>
								<label for="decision-{i}-name" class="mb-1 block text-sm font-medium text-gray-700"
									>Key</label
								>
								<input
									id="decision-{i}-name"
									bind:value={decision.name}
									class="{inputClass} font-mono"
									spellcheck="false"
								/>
							</div>
							<div>
								<label
									for="decision-{i}-threshold"
									class="mb-1 block text-sm font-medium text-gray-700">Threshold</label
								>
								<input
									id="decision-{i}-threshold"
									type="number"
									step="0.05"
									min="0"
									max="1"
									bind:value={decision.threshold}
									class={inputClass}
								/>
							</div>
							<div>
								<label
									for="decision-{i}-action"
									class="mb-1 block text-sm font-medium text-gray-700">Action</label
								>
								<select id="decision-{i}-action" bind:value={decision.action} class={inputClass}>
									{#each Object.entries(ACTION_LABELS) as [action, label] (action)}
										<option value={action as SecurityAction}>{label}</option>
									{/each}
								</select>
							</div>
						</div>

						<div class="mt-4">
							<label
								for="decision-{i}-description"
								class="mb-1 block text-sm font-medium text-gray-700">Question for the model</label
							>
							<textarea
								id="decision-{i}-description"
								bind:value={decision.description}
								rows="2"
								class={inputClass}
							></textarea>
						</div>

						<div class="mt-4">
							<label
								for="decision-{i}-action-text"
								class="mb-1 block text-sm font-medium text-gray-700"
								>Message to the respondent</label
							>
							<textarea
								id="decision-{i}-action-text"
								bind:value={decision.action_text}
								rows="2"
								class={inputClass}
							></textarea>
						</div>

						<div class="mt-4 flex items-center justify-between">
							<label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
								<input
									type="checkbox"
									bind:checked={decision.respondent_override}
									class="rounded border-gray-300 text-primary focus:ring-primary"
								/>
								The respondent may choose to carry on instead
							</label>
							<button
								type="button"
								class="text-sm text-red-600 hover:underline"
								onclick={() => removeDecision(i)}>Remove</button
							>
						</div>

						{#if problems}
							<ul class="mt-3 list-disc pl-5 text-sm text-red-600">
								{#each problems as problem (problem)}
									<li>{problem}</li>
								{/each}
							</ul>
						{/if}
					</fieldset>
				{/each}
			</div>

			{#each errors?.policy ?? [] as problem (problem)}
				<p class="mt-3 text-sm text-red-600">{problem}</p>
			{/each}

			<button
				type="button"
				class="mt-4 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
				onclick={addDecision}
			>
				<i class="fa-solid fa-plus mr-1"></i> Add decision
			</button>
		</div>
	{/if}
</section>
