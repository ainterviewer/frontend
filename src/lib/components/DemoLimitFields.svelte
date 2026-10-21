<script lang="ts">
	import type { DemoBudget, DemoLimitDefaults } from '$lib/api';

	/**
	 * The per-user overrides of the demo accounts' synthetic-interview budgets.
	 * Empty means the configured default, so every value is `number | null`.
	 *
	 * With `usage`, each field also says how much of that budget the user has
	 * spent, measured against the limit as edited, so an admin sees what a new
	 * value would leave them before saving it.
	 */
	let {
		concurrent = $bindable(null),
		daily = $bindable(null),
		lifetime = $bindable(null),
		defaults = null,
		usage = null,
		inputClass = 'mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary'
	}: {
		concurrent: number | null;
		daily: number | null;
		lifetime: number | null;
		defaults?: DemoLimitDefaults | null;
		usage?: DemoBudget | null;
		inputClass?: string;
	} = $props();

	type Key = keyof DemoLimitDefaults;

	const USED_LABELS: Record<Key, string> = {
		concurrent: 'running now',
		daily: 'started in the last 24 hours',
		lifetime: 'started in total'
	};

	// A number input binds an empty field as undefined (or null); either way
	// that is "no override", which the API takes as null.
	function toLimit(value: number | null | undefined): number | null {
		if (value == null || Number.isNaN(value)) return null;
		return Math.max(0, Math.trunc(value));
	}

	// The limit the field would give the user: the override if one is entered,
	// else the default.
	function effectiveLimit(key: Key, value: number | null): number | null {
		return value ?? defaults?.[key] ?? null;
	}
</script>

{#snippet limitInput(
	key: Key,
	label: string,
	get: () => number | null,
	set: (v: number | null) => void
)}
	{@const limit = effectiveLimit(key, get())}
	{@const used = usage?.[key].used}
	<label class="block text-sm">
		<span class="text-xs text-gray-500">{label}</span>
		<input
			type="number"
			min="0"
			step="1"
			placeholder={defaults ? `Default (${defaults[key]})` : 'Default'}
			class={inputClass}
			bind:value={get, (v) => set(toLimit(v))}
			onclick={(e) => e.stopPropagation()}
		/>
		{#if used !== undefined}
			<span
				class="mt-1 block text-xs tabular-nums {limit !== null && used >= limit
					? 'text-red-600'
					: 'text-gray-500'}"
			>
				{`${used} ${USED_LABELS[key]}`}{#if limit !== null}{` · ${Math.max(limit - used, 0)} left`}{/if}
			</span>
		{/if}
	</label>
{/snippet}

<fieldset>
	<legend class="text-xs font-medium text-gray-600">
		Demo synthetic interview limits
		<span class="font-normal text-gray-400">(empty uses the default)</span>
	</legend>
	<div class="grid grid-cols-3 gap-3">
		{@render limitInput(
			'concurrent',
			'At once',
			() => concurrent,
			(v) => (concurrent = v)
		)}
		{@render limitInput(
			'daily',
			'Per 24 hours',
			() => daily,
			(v) => (daily = v)
		)}
		{@render limitInput(
			'lifetime',
			'In total',
			() => lifetime,
			(v) => (lifetime = v)
		)}
	</div>
</fieldset>
