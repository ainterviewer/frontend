import type { Consent, InterviewGuideOutput, Welcome } from '$lib/api/types.gen';

interface UnifiedSetupExportJson {
	consent: Consent | null;
	welcome: Welcome | null;
	interview_guide: InterviewGuideOutput | null;
	platform_version: string | null;
}

export function downloadUnifiedSetupJson(data: UnifiedSetupExportJson) {
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'interview_guide.json';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
