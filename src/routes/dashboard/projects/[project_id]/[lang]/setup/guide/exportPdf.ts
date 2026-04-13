import type {
	Condition,
	ConditionsOutput,
	Consent,
	Image,
	InterviewGuideOutput,
	TimedMessage,
	Welcome
} from '$lib/api/types.gen';
import type { GuideQuestion, GuideSection } from './types';

// pdfmake doesn't ship type declarations — use a generic record type for doc nodes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfNode = Record<string, any>;

type SurveyItem = NonNullable<GuideQuestion['survey_item']>;

export interface PdfToggles {
	consent: boolean;
	welcome: boolean;
	framing: boolean;
	introduction: boolean;
	questionSections: boolean;
	outro: boolean;
	timedMessages: boolean;
	behaviorFlags: boolean;
	conditions: boolean;
}

export const defaultPdfToggles = (): PdfToggles => ({
	consent: true,
	welcome: true,
	framing: true,
	introduction: true,
	questionSections: true,
	outro: true,
	timedMessages: true,
	behaviorFlags: true,
	conditions: true
});

interface ExportOptions {
	guide: InterviewGuideOutput;
	sections: GuideSection[];
	questions: Record<string, GuideQuestion[]>;
	projectName: string;
	toggles: PdfToggles;
	consent?: Consent | null;
	welcome?: Welcome | null;
}

function heading(text: string, level: 1 | 2 | 3 | 4): PdfNode {
	const sizes: Record<number, number> = { 1: 20, 2: 16, 3: 14, 4: 12 };
	return {
		text,
		fontSize: sizes[level],
		bold: true,
		margin: level === 1 ? [0, 0, 0, 8] : [0, 12, 0, 4]
	};
}

function label(text: string): PdfNode {
	return { text, bold: true, fontSize: 10, color: '#555555', margin: [0, 4, 0, 2] };
}

function bodyText(text: string | null | undefined): PdfNode {
	if (!text) return { text: '' };
	return { text, fontSize: 10, margin: [0, 0, 0, 4] };
}

function separator(): PdfNode {
	return {
		canvas: [
			{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#dddddd' }
		],
		margin: [0, 8, 0, 8]
	};
}

function buildSurveyItemContent(item: SurveyItem): PdfNode[] {
	const content: PdfNode[] = [];
	const type = item.type ?? 'unknown';

	content.push(label(`Survey Item (${type})`));

	if ('options' in item && item.options) {
		content.push({
			ul: item.options.map((opt: string) => ({ text: opt, fontSize: 10 })),
			margin: [12, 0, 0, 4]
		});
		if ('with_other' in item && item.with_other) {
			content.push({
				text: '+ Other (free text)',
				fontSize: 9,
				italics: true,
				margin: [12, 0, 0, 4]
			});
		}
		if ('ui' in item && item.ui) {
			content.push({
				text: `Display: ${item.ui}`,
				fontSize: 9,
				color: '#666',
				margin: [12, 0, 0, 4]
			});
		}
	}

	if ('min' in item && item.min !== undefined && item.min !== null) {
		const parts: string[] = [];
		parts.push(`Min: ${item.min}`);
		if ('max' in item && item.max !== undefined && item.max !== null)
			parts.push(`Max: ${item.max}`);
		if ('step' in item && item.step !== undefined && item.step !== null)
			parts.push(`Step: ${item.step}`);
		if ('min_label' in item && item.min_label) parts.push(`Min label: ${item.min_label}`);
		if ('max_label' in item && item.max_label) parts.push(`Max label: ${item.max_label}`);
		if (parts.length > 0) {
			content.push({
				text: parts.join(' | '),
				fontSize: 9,
				color: '#666',
				margin: [12, 0, 0, 4]
			});
		}
	}

	if (item.required) {
		content.push({
			text: 'Required',
			fontSize: 9,
			italics: true,
			color: '#666',
			margin: [12, 0, 0, 4]
		});
	}

	return content;
}

function buildConditionsContent(conditions: ConditionsOutput, sections: GuideSection[]): PdfNode[] {
	const content: PdfNode[] = [];

	content.push(label(`Conditions (Action: ${formatAction(conditions.action)})`));

	for (const cond of conditions.conditions) {
		const condText = buildConditionText(cond, sections);
		content.push({ text: condText, fontSize: 9, margin: [12, 0, 0, 2] });
	}

	return content;
}

function formatAction(action: string): string {
	return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildConditionText(cond: Condition, sections: GuideSection[]): string {
	const { question_context, evaluation, negated, trigger_type, combine_next } = cond;
	const sectionIdx = question_context.section;
	const questionIdx = question_context.question;
	const sectionName =
		sections[sectionIdx]?.description?.slice(0, 40) || `Section ${sectionIdx + 1}`;
	const ref = `[S${sectionIdx + 1} Q${questionIdx + 1}] (${sectionName})`;
	const trigger = trigger_type === 'classification' ? 'Classification' : 'Match';
	const neg = negated ? ' NOT' : '';
	const evals = evaluation
		.map((e) => {
			const op = e.comparison_operator ?? '==';
			const val = e.trigger_value;
			return `${op} "${val}"${e.combine_next ? ` ${e.combine_next}` : ''}`;
		})
		.join(' ');

	let text = `${trigger}${neg}: ${ref} ${evals}`;
	if (combine_next) text += ` ${combine_next}`;
	return text;
}

function buildImageContent(image: Image): PdfNode[] {
	const content: PdfNode[] = [];

	content.push(label('Image'));
	if (image.primer) {
		content.push({ text: `Primer: ${image.primer}`, fontSize: 9, margin: [12, 0, 0, 2] });
	}
	content.push({ text: `File: ${image.name}`, fontSize: 9, margin: [12, 0, 0, 2] });
	if (image.description) {
		content.push({
			text: `Description: ${image.description}`,
			fontSize: 9,
			color: '#666',
			margin: [12, 0, 0, 2]
		});
	}
	if (image.alt) {
		content.push({
			text: `Alt: ${image.alt}`,
			fontSize: 9,
			color: '#666',
			margin: [12, 0, 0, 2]
		});
	}

	if (image.data) {
		try {
			const dataUri = image.data.startsWith('data:')
				? image.data
				: `data:image/png;base64,${image.data}`;
			content.push({
				image: dataUri,
				width: 300,
				margin: [12, 4, 0, 4]
			});
		} catch {
			// Skip image embedding if data is invalid
		}
	}

	return content;
}

function indentNode(node: PdfNode, left: number = 8): PdfNode {
	const existing = node.margin as number[] | undefined;
	if (existing) {
		return { ...node, margin: [left, existing[1], existing[2], existing[3]] };
	}
	return { ...node, margin: [left, 0, 0, 0] };
}

function buildQuestionContent(
	q: GuideQuestion,
	qIdx: number,
	sections: GuideSection[],
	toggles: PdfToggles
): PdfNode[] {
	const content: PdfNode[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const qAny = q as any;

	// Question header
	content.push({
		text: `Q${qIdx + 1}: ${q.main_question}`,
		fontSize: 11,
		bold: true,
		margin: [8, 8, 0, 2]
	});

	// Description
	if (q.description) {
		content.push({
			text: q.description,
			fontSize: 9,
			italics: true,
			color: '#666',
			margin: [8, 0, 0, 4]
		});
	}

	// Alternative main questions (not in generated types but used at runtime)
	if (qAny.alternative_main_questions && qAny.alternative_main_questions.length > 0) {
		content.push(indentNode(label('Alternative Phrasings')));
		for (const alt of qAny.alternative_main_questions) {
			content.push({ text: `- ${alt}`, fontSize: 9, margin: [16, 0, 0, 1] });
		}
	}

	// Probes (always visible per requirements)
	if (q.probes && q.probes.length > 0) {
		content.push(indentNode(label('Suggested Probes')));
		content.push({
			ul: q.probes.map((p) => ({ text: p, fontSize: 9 })),
			margin: [20, 0, 0, 4]
		});
		if (q.max_probes_n !== undefined && q.max_probes_n !== null) {
			const timePart = q.max_probes_time ? ` | Max time: ${q.max_probes_time}s` : '';
			content.push({
				text: `Max probes: ${q.max_probes_n}${timePart}`,
				fontSize: 8,
				color: '#888',
				margin: [8, 0, 0, 4]
			});
		}
	}

	// Survey item (always visible per requirements)
	if (q.survey_item) {
		const surveyContent = buildSurveyItemContent(q.survey_item);
		for (const c of surveyContent) {
			content.push(indentNode(c));
		}
	}

	// Conditions (gated by toggle)
	if (toggles.conditions && q.conditions && q.conditions.conditions.length > 0) {
		const condContent = buildConditionsContent(q.conditions, sections);
		for (const c of condContent) {
			content.push(indentNode(c));
		}
	}

	// Image (always visible per requirements)
	if (q.image) {
		const imgContent = buildImageContent(q.image);
		for (const c of imgContent) {
			content.push(c);
		}
	}

	// References
	if (q.references && q.references.length > 0) {
		content.push(indentNode(label('References')));
		for (const ref of q.references) {
			content.push({
				text: `Section ${ref.question_index[0] + 1}, Question ${ref.question_index[1] + 1}`,
				fontSize: 9,
				margin: [16, 0, 0, 1]
			});
		}
	}

	// Variables
	if (q.variables && q.variables.length > 0) {
		content.push(indentNode(label('Variables')));
		content.push({ text: q.variables.join(', '), fontSize: 9, margin: [16, 0, 0, 4] });
	}

	// Behavior flags (gated by toggle)
	if (toggles.behaviorFlags) {
		const settings: string[] = [];
		if (q.can_answer === false) settings.push('Message only (no answer)');
		if (q.can_skip === false) settings.push('Cannot skip');
		if (q.shuffle) settings.push('Shuffle');
		if (q.create_segue) settings.push('Create segue');
		if (q.exclude_from_history) settings.push('Exclude from history');
		if (q.check_if_answered) settings.push('Check if answered');
		if (q.check_if_exhausted) settings.push('Check if exhausted');
		if (q.user_image) settings.push('User can upload image');
		if (q.probing_context) settings.push(`Probing context: ${q.probing_context}`);

		if (settings.length > 0) {
			content.push(indentNode(label('Settings')));
			content.push({
				text: settings.join(' | '),
				fontSize: 8,
				color: '#888',
				margin: [8, 0, 0, 4]
			});
		}
	}

	return content;
}

function buildTimedMessageContent(tm: TimedMessage, idx: number, toggles: PdfToggles): PdfNode[] {
	const content: PdfNode[] = [];

	content.push({
		text: `Timed Message ${idx + 1} (at ${tm.time}s)`,
		fontSize: 11,
		bold: true,
		margin: [0, 4, 0, 2]
	});
	content.push(bodyText(tm.message));

	if (toggles.behaviorFlags) {
		const flags: string[] = [];
		if (tm.include_in_history) flags.push('Include in history');
		if (tm.as_modal) flags.push('Show as modal');
		if (flags.length > 0) {
			content.push({
				text: flags.join(' | '),
				fontSize: 8,
				color: '#888',
				margin: [0, 0, 0, 4]
			});
		}
	}

	return content;
}

export function exportGuidePdf(options: ExportOptions): PdfNode {
	const { guide, sections, questions, projectName, toggles, consent, welcome } = options;

	const content: PdfNode[] = [];

	// Title
	content.push({
		text: projectName,
		fontSize: 24,
		bold: true,
		margin: [0, 0, 0, 4]
	});
	content.push({
		text: 'Interview Guide',
		fontSize: 14,
		color: '#666',
		margin: [0, 0, 0, 4]
	});
	content.push({
		text: new Date().toLocaleDateString(),
		fontSize: 10,
		color: '#999',
		margin: [0, 0, 0, 16]
	});

	// Consent
	if (toggles.consent && consent) {
		content.push(heading('Consent', 2));
		if (consent.title) {
			content.push({ text: consent.title, fontSize: 12, bold: true, margin: [0, 0, 0, 4] });
		}
		if (consent.text) content.push(bodyText(consent.text));
		content.push(separator());
	}

	// Welcome
	if (toggles.welcome && welcome) {
		content.push(heading('Welcome', 2));
		if (welcome.title) {
			content.push({ text: welcome.title, fontSize: 12, bold: true, margin: [0, 0, 0, 4] });
		}
		if (welcome.text) content.push(bodyText(welcome.text));
		if (welcome.email) {
			content.push({
				text: `Contact: ${welcome.email}`,
				fontSize: 9,
				color: '#666',
				margin: [0, 0, 0, 4]
			});
		}
		if (welcome.video_file_name) {
			content.push({
				text: `Video: ${welcome.video_file_name}`,
				fontSize: 9,
				color: '#666',
				margin: [0, 0, 0, 4]
			});
		}
		content.push(separator());
	}

	// Framing
	if (toggles.framing && guide.framing) {
		content.push(heading('Framing', 2));
		content.push({
			text: 'Context for the AI model (not shown to interviewee)',
			fontSize: 9,
			italics: true,
			color: '#888',
			margin: [0, 0, 0, 4]
		});
		content.push(bodyText(guide.framing));
		content.push(separator());
	}

	// Introduction
	if (toggles.introduction && guide.introduction) {
		content.push(heading('Introduction', 2));
		content.push(bodyText(guide.introduction));
		content.push(separator());
	}

	// Question Sections
	if (toggles.questionSections && sections.length > 0) {
		content.push(heading('Question Sections', 2));

		for (let sIdx = 0; sIdx < sections.length; sIdx++) {
			const section = sections[sIdx];
			const sectionQuestions = questions[section.id] || [];

			content.push(heading(`Section ${sIdx + 1}`, 3));

			if (section.description) {
				content.push({ ...label('Description'), margin: [0, 0, 0, 2] });
				content.push(bodyText(section.description));
			}

			if (toggles.behaviorFlags && section.shuffle) {
				content.push({
					text: 'Shuffle: enabled',
					fontSize: 8,
					color: '#888',
					margin: [0, 0, 0, 4]
				});
			}

			// Questions
			for (let qIdx = 0; qIdx < sectionQuestions.length; qIdx++) {
				const qContent = buildQuestionContent(
					sectionQuestions[qIdx],
					qIdx,
					sections,
					toggles
				);
				// Wrap question in a bordered box
				content.push({
					margin: [0, 4, 0, 4],
					table: {
						widths: ['*'],
						body: [[{ stack: qContent, margin: [4, 4, 4, 4] }]]
					},
					layout: {
						hLineWidth: () => 0.5,
						vLineWidth: () => 0.5,
						hLineColor: () => '#e0e0e0',
						vLineColor: () => '#e0e0e0'
					}
				});
			}

			if (sIdx < sections.length - 1) {
				content.push(separator());
			}
		}

		content.push(separator());
	}

	// Outro
	if (toggles.outro && guide.outro) {
		content.push(heading('Outro', 2));
		content.push(bodyText(guide.outro));
		content.push(separator());
	}

	// Timed Messages
	if (toggles.timedMessages && guide.timed_messages && guide.timed_messages.length > 0) {
		content.push(heading('Timed Messages', 2));
		for (let i = 0; i < guide.timed_messages.length; i++) {
			const tmContent = buildTimedMessageContent(guide.timed_messages[i], i, toggles);
			content.push(...tmContent);
		}
	}

	return {
		content,
		defaultStyle: {
			font: 'Roboto'
		},
		pageMargins: [40, 40, 40, 40],
		footer: (currentPage: number, pageCount: number) => ({
			text: `Page ${currentPage} of ${pageCount}`,
			alignment: 'center',
			fontSize: 8,
			color: '#aaa',
			margin: [0, 10, 0, 0]
		})
	};
}

export async function downloadGuidePdf(options: ExportOptions) {
	// Dynamic import to keep pdfmake out of the main bundle
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const pdfMakeModule: any = await import('pdfmake/build/pdfmake');
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const pdfFontsModule: any = await import('pdfmake/build/vfs_fonts');

	const pdfMake = pdfMakeModule.default || pdfMakeModule;
	if (pdfFontsModule?.pdfMake?.vfs) {
		pdfMake.vfs = pdfFontsModule.pdfMake.vfs;
	} else if (pdfFontsModule?.default?.pdfMake?.vfs) {
		pdfMake.vfs = pdfFontsModule.default.pdfMake.vfs;
	}

	const docDefinition = exportGuidePdf(options);
	const filename = `${options.projectName.replace(/[^a-zA-Z0-9]/g, '_')}_interview_guide.pdf`;
	pdfMake.createPdf(docDefinition).download(filename);
}
