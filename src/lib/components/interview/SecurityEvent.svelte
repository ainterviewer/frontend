<script lang="ts">
	import type { SecurityEvent } from './security';

	interface Props {
		event: SecurityEvent;
		/** The message the respondent was shown. */
		text?: string;
	}

	let { event, text }: Props = $props();

	const ACTIONS = {
		end_interview: 'Ended the interview',
		skip_section: 'Skipped the rest of the section',
		skip_probes: 'Skipped the remaining probes'
	} as const;
</script>

{#if event.kind === 'intervention'}
	<div class="mx-auto my-2 w-full max-w-md rounded-lg bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
		<div class="flex items-center gap-2 text-xs font-semibold text-amber-800">
			<i class="fa-solid fa-shield-heart"></i>
			<span>Safety check</span>
			<span class="font-normal text-amber-700">
				· {ACTIONS[event.action]}{event.respondent_override ? ', unless overridden' : ''}
			</span>
		</div>
		{#if text}
			<p class="mt-1.5 text-sm whitespace-pre-line text-gray-700">{text}</p>
		{/if}
	</div>
{:else}
	<div class="my-1 text-center text-xs text-amber-800">
		<i class="fa-solid fa-reply mr-1"></i>
		{event.answer === 'override'
			? 'The respondent overrode the safety check and continued'
			: 'The respondent accepted the safety check'}
	</div>
{/if}
