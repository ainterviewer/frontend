import { toast } from 'svelte-sonner';

import { Projects } from '$lib/api';
import type { Consent, Welcome } from '$lib/api/types.gen';
import type { ContentSession } from '$lib/collab/contentSession.svelte';
import { toastApiError } from '$lib/utils/toast';

import { downloadUnifiedSetupJson } from './exportJson';
import { downloadGuidePdf, type PdfToggles } from './exportPdf';
import { renderSaved } from './guide/render';

// What the three setup editors -- guide, consent, welcome -- do alike. Each
// edits one part live and reads the other two from the server for an export.

/** The guide as an export renders it. */
export type RenderedGuide = ReturnType<typeof renderSaved>;

/**
 * A setup's three parts, for an export: the page's own from its live state,
 * the others from the server. Consent and welcome are null when there is
 * none; the guide throws when it cannot be had.
 */
export interface SetupParts {
	guide: () => RenderedGuide | Promise<RenderedGuide>;
	consent: () => Consent | null | Promise<Consent | null>;
	welcome: () => Welcome | null | Promise<Welcome | null>;
}

/** The saved guide, rendered for `languages`. */
export async function savedGuide(projectId: string, languages: string[]): Promise<RenderedGuide> {
	const { data, error } = await Projects.getLocalizedGuide({ path: { project_id: projectId } });
	if (error || !data) throw error ?? new Error('No interview guide returned');
	return renderSaved(data, languages);
}

/** The draft's consent in `language`, like the part being exported. */
export async function draftConsent(projectId: string, language: string): Promise<Consent | null> {
	const { data } = await Projects.getConsent({
		path: { project_id: projectId, language },
		query: { draft: true }
	});
	return data ?? null;
}

/** The draft's welcome in `language`, like the part being exported. */
export async function draftWelcome(projectId: string, language: string): Promise<Welcome | null> {
	const { data } = await Projects.getWelcome({
		path: { project_id: projectId, language },
		query: { draft: true }
	});
	return data ?? null;
}

interface ExportMeta {
	projectName: string;
	platformVersion: string | null;
}

/** Download the setup as a PDF; whether it worked, a failure being toasted. */
export async function exportSetupPdf(
	parts: SetupParts,
	toggles: PdfToggles,
	{ projectName, platformVersion }: ExportMeta
): Promise<boolean> {
	try {
		const [{ guide, sections, questions }, consent, welcome] = await Promise.all([
			parts.guide(),
			toggles.consent ? parts.consent() : null,
			toggles.welcome ? parts.welcome() : null
		]);
		await downloadGuidePdf({
			guide,
			sections,
			questions,
			projectName: projectName || 'Interview Guide',
			platformVersion,
			toggles,
			consent,
			welcome
		});
		return true;
	} catch (e) {
		console.error('Failed to export the PDF', e);
		toast.error('Failed to export the PDF');
		return false;
	}
}

/** Download the setup as JSON, leaving out a part that could not be had. */
export async function exportSetupJson(
	parts: SetupParts,
	platformVersion: string | null
): Promise<void> {
	const settle = async <T>(part: () => T | Promise<T>) => {
		try {
			return await part();
		} catch (e) {
			console.error('Left a part out of the JSON export', e);
			return null;
		}
	};
	const [guide, consent, welcome] = await Promise.all([
		settle(parts.guide),
		settle(parts.consent),
		settle(parts.welcome)
	]);
	try {
		downloadUnifiedSetupJson({
			consent,
			welcome,
			interview_guide: guide?.guide ?? null,
			platform_version: platformVersion
		});
	} catch (e) {
		console.error('Failed to export the JSON', e);
		toast.error('Failed to export the JSON');
	}
}

/**
 * Before publishing: what is published is what the server has, so this tab's
 * changes must have reached it.
 */
export function syncedForPublish(session: ContentSession): boolean {
	if (session.status === 'synced') return true;
	toast.error('Reconnecting to the server; publish once your changes are saved');
	return false;
}

/**
 * Machine-translate what `language` lacks from the default language. The
 * server saves the doc first and merges the translation into it, so it
 * arrives in the editor like anyone else's edit.
 */
export async function translateMissing(
	projectId: string,
	language: string,
	languageName: string
): Promise<void> {
	const { data, error } = await Projects.translateMissing({
		path: { project_id: projectId, lang: language }
	});
	if (error || !data) {
		toastApiError(error, 'Failed to translate the missing text');
		return;
	}
	toast.success(`Translated the missing ${languageName} text`);
}
