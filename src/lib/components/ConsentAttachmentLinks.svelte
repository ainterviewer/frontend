<script lang="ts">
	// The consent's PDFs as respondents see them: a card per file under the
	// text, each opening the file in a new tab. The file name is the label.
	// Cards carry `consent-attachment`, which the consent dialogs' link styling
	// for the respondent's own text leaves alone.
	import { type ConsentAttachmentLink, formatBytes } from '$lib/consentAttachments';

	let { attachments }: { attachments: ConsentAttachmentLink[] } = $props();
</script>

{#if attachments.length}
	<!-- A container query, not a breakpoint: the same list sits in the narrow
	     live preview and the wide dialog. -->
	<div class="@container mt-6">
		<ul class="grid gap-2 @md:grid-cols-2">
			{#each attachments as attachment (attachment.href)}
				<li class="min-w-0">
					<!-- eslint-disable svelte/no-navigation-without-resolve -- a backend file, not a route -->
					<a
						href={attachment.href}
						target="_blank"
						rel="noopener noreferrer"
						title={attachment.label}
						class="consent-attachment group flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-blue-600 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none"
					>
						<span
							class="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-800"
							aria-hidden="true"
						>
							<i class="fa-solid fa-file-pdf text-lg"></i>
						</span>
						<span class="min-w-0 flex-1">
							<span
								class="block truncate text-sm font-medium text-gray-900 group-hover:text-blue-600"
							>
								{attachment.label}
							</span>
							<span class="block text-xs text-gray-500">
								PDF · {formatBytes(attachment.size)}
							</span>
						</span>
						<i
							class="fa-solid fa-arrow-up-right-from-square shrink-0 text-xs text-gray-400 group-hover:text-blue-600"
							aria-hidden="true"
						></i>
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
	</div>
{/if}
