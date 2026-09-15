import {
	DEFAULT_PALETTE,
	DEFAULT_SCORE_MAX,
	DEFAULT_SCORE_MIN,
	type Code,
	type CodeKind
} from './codingTree';

/**
 * A worked codebook to open the canvas on.
 *
 * The page has no backend yet, and an empty canvas is a poor way to find out
 * what this screen is for: a coding tree only makes its case once there is a
 * tree, with definitions and memos on it, to move around. It is also the
 * fixture the interactions are developed against -- deep enough to have a third
 * level, wide enough that re-parenting changes the layout visibly.
 *
 * It is written as a real codebook rather than as filler, because the shape of
 * the example teaches the format: definitions are inclusion rules a second
 * coder could apply rather than descriptions, and the memos carry the decisions
 * behind the tree -- what was split from what, where coders disagreed, which
 * codes are still too thin to keep. The study it comes from is an interview
 * study of how people account for their own part in the green transition, the
 * kind of project these interviews are conducted for.
 *
 * The last branch is the one worth noticing: codes about the interview as a
 * social situation. On a platform where the interviewer is an agent, what a
 * participant thought was wanted of them is data about the method, and a
 * codebook that has nowhere to put it ends up smuggling it into the substantive
 * codes instead.
 *
 * The branch after it shows the other two kinds a code can be. Its children are
 * scores -- rated once per interview, with the ends of the scale written into
 * the definition, because that is the whole difference between a score and a
 * tag with a number stuck on it -- and the branch head itself is a group, a
 * heading that is never applied to anything.
 *
 * Written as an outline and flattened below, because that is how a codebook is
 * actually read. Ids are stable strings rather than generated ones so a reload
 * lands on the same tree.
 */

type SeedNode = {
	id: string;
	name: string;
	definition: string;
	memo?: string;
	/** Defaults to `tag`, which is what most of a codebook is. */
	kind?: CodeKind;
	/** Only read for a `score`; the default scale is used when left off. */
	min?: number;
	max?: number;
	children?: SeedNode[];
};

const outline: SeedNode[] = [
	{
		id: 'seed-responsibility',
		name: 'Who is responsible',
		definition:
			'Passages where the participant assigns responsibility for acting on climate change to somebody — themselves, the state, industry, other countries. Requires an attribution, not merely a complaint.',
		memo: 'The spine of the analysis: the research question is about how responsibility is distributed in participants’ accounts. Almost every interview has all three sub-codes in it, often in the same breath, so co-occurrence matters more here than counts.',
		children: [
			{
				id: 'seed-responsibility-individual',
				name: 'Individual responsibility',
				definition:
					'Responsibility placed on ordinary people, including the participant themselves. Covers both claims that individuals should act and claims that they already do.',
				children: [
					{
						id: 'seed-responsibility-individual-moral',
						name: 'Everyday choices as moral acts',
						definition:
							'Consumption or household choices described in moral terms — right, wrong, guilt, duty. The moral framing must be the participant’s, not the interviewer’s prompt.',
						memo: 'Split out of “Individual responsibility” after the fourth interview: the moral register is doing something different from a plain statement that individuals matter, and pooling the two hid it.'
					},
					{
						id: 'seed-responsibility-individual-limits',
						name: 'Limits of individual action',
						definition:
							'Explicit statements that individual action is insufficient, pointless or a distraction. Distinct from describing a practical obstacle, which belongs under “What makes acting hard”.',
						memo: 'The boundary with the constraints branch is the one coders get wrong. Rule of thumb: “it would not matter anyway” is here; “I cannot afford it” is a constraint.'
					}
				]
			},
			{
				id: 'seed-responsibility-state',
				name: 'The state and regulation',
				definition:
					'Responsibility placed on government, legislation, taxation or public provision, including demands to be regulated rather than asked.',
				memo: 'Watch for the “make it easy for me” formulation — participants asking to have the choice removed. If it keeps recurring it probably deserves its own code under here.'
			},
			{
				id: 'seed-responsibility-elsewhere',
				name: 'Responsibility placed elsewhere',
				definition:
					'Responsibility assigned to distant or abstract actors: other countries, large industry, “the system”, previous generations.',
				memo: 'In vivo phrase worth keeping: “it is all China anyway”. Reads as deflection, but two participants use it while also describing extensive changes of their own — do not treat the code as evidence of inaction.'
			}
		]
	},
	{
		id: 'seed-constraints',
		name: 'What makes acting hard',
		definition:
			'Concrete obstacles to acting as the participant says they would want to. Requires an obstacle the participant names, not one the analyst infers.',
		children: [
			{
				id: 'seed-constraints-money',
				name: 'Cost and household economy',
				definition:
					'Money as the obstacle: up-front costs, price differences, the household budget. Includes cases where the cheaper option is also the greener one.',
				memo: 'Strongly patterned by the household-income variable. Keep the code descriptive here; the comparison belongs in the analysis, not in the codebook.'
			},
			{
				id: 'seed-constraints-place',
				name: 'Where you live',
				definition:
					'The built environment as the obstacle: distances, what is available locally, what the housing allows.',
				children: [
					{
						id: 'seed-constraints-place-car',
						name: 'Car dependence',
						definition:
							'Passages where a car is described as unavoidable given where the participant lives or works. Excludes passages about liking or preferring to drive.',
						memo: 'Saturated by interview 9 — the same account recurs almost verbatim. Candidate for a short illustrative section rather than further collection.'
					}
				]
			},
			{
				id: 'seed-constraints-time',
				name: 'Time and household logistics',
				definition:
					'Time, effort and coordination within the household as the obstacle, including work schedules and childcare.',
				memo: 'Thin so far (4 passages, 3 of them from the same participant). Either the guide is not asking for it, or it is a sub-case of “Where you live”. Revisit before the next round.'
			}
		]
	},
	{
		id: 'seed-self',
		name: 'Positioning oneself',
		definition:
			'How participants place themselves relative to a standard of acting well — claiming, qualifying or disclaiming it.',
		memo: 'An interpretive branch rather than a descriptive one, so it needs the tightest definitions in the book. Double-coded with a second coder on interviews 2, 5 and 11.',
		children: [
			{
				id: 'seed-self-enough',
				name: 'Doing your bit',
				definition:
					'Claims to be doing a reasonable amount, often bounded (“what I can”, “within reason”).'
			},
			{
				id: 'seed-self-hypocrisy',
				name: 'Self-directed hypocrisy talk',
				definition:
					'The participant names an inconsistency in their own conduct before the interviewer could. Must be self-directed; the same charge aimed at others goes under “Comparison with others”.',
				memo: 'The most interesting code in the book and the least stable one. Coder disagreement on whether a flat admission with no evaluative work (“I fly, yes”) belongs here — currently excluded.'
			},
			{
				id: 'seed-self-comparison',
				name: 'Comparison with others',
				definition:
					'The participant’s conduct measured against other people — neighbours, family, a generation, an imagined extreme.',
				memo: 'Often the vehicle for the “Responsibility placed elsewhere” move. Their co-occurrence is worth a figure.'
			}
		]
	},
	{
		id: 'seed-interview',
		name: 'The interview as a situation',
		definition:
			'Passages about the interview itself: what the participant thought was being asked of them, or how they were managing the encounter.',
		memo: 'Methodological rather than substantive, and kept separate for that reason — these passages are evidence about the instrument, not about the green transition. Report them in the methods section, never pooled with the branches above.',
		children: [
			{
				id: 'seed-interview-expectation',
				name: 'Guessing what is wanted',
				definition:
					'The participant orients to what they take the study, or the interviewer, to want to hear.',
				memo: 'The code that justifies this whole branch. If it clusters in particular questions of the guide, that is a finding about the guide.'
			},
			{
				id: 'seed-interview-repair',
				name: 'Taking an answer back',
				definition:
					'The participant revises, softens or withdraws something they have just said, in a way that treats the earlier version as a problem.',
				memo: 'Do not code ordinary self-correction mid-sentence; the revision has to be treated as something needing repair.'
			}
		]
	},
	{
		id: 'seed-quality',
		name: 'How the interview went',
		kind: 'group',
		definition:
			'A heading, not a code. Its children are rated once per interview rather than applied to passages, so nothing is ever coded here directly.',
		memo: 'Kept as a group so the counts stay readable: these are properties of an interview, and pooling them with the passage codes above would make every table mix two units of analysis. Rate every interview, including the ones that went badly — a missing rating and a low one are not the same thing.',
		children: [
			{
				id: 'seed-quality-elaboration',
				name: 'Elaboration',
				kind: 'score',
				definition:
					'How far the participant develops answers without being asked to. 1 = answers close on a sentence and have to be followed up every time; 3 = develops when prompted; 5 = volunteers episodes and examples unprompted.',
				memo: 'The anchors are what makes this codable by a second rater — a score whose ends are not written down is one person’s impression with a number on it.'
			},
			{
				id: 'seed-quality-rapport',
				name: 'Rapport',
				kind: 'score',
				definition:
					'How settled the participant seems with the interviewer. 1 = guarded or formal throughout; 3 = comfortable but careful; 5 = speaks freely, including about things that do not flatter them.',
				memo: 'Reads against “Guessing what is wanted”: low rapport and heavy orientation to what is wanted tend to arrive together, which is the pattern to test rather than assume.'
			},
			{
				id: 'seed-quality-steering',
				name: 'Interviewer steering',
				kind: 'score',
				definition:
					'How much of the content came from the interviewer rather than the participant. 1 = the participant sets the terms; 3 = ordinary prompting; 5 = the answers largely restate the question’s own framing.',
				memo: 'The one rating that is about the instrument rather than the participant. High values are a reason to discount the substantive codes in that interview, so it is worth recording even when nothing else about the interview is remarkable.'
			}
		]
	}
];

/** Depth-first, so the array reads as the outline above. */
export function seedCodes(): Code[] {
	const codes: Code[] = [];
	const walk = (nodes: SeedNode[], parentId: string | null, color: string) => {
		nodes.forEach((node, index) => {
			// Top-level codes take the next palette hue; everything under them
			// inherits it, so a branch reads as one thing at a glance.
			const branchColor =
				parentId === null ? DEFAULT_PALETTE[index % DEFAULT_PALETTE.length] : color;
			const kind = node.kind ?? 'tag';
			codes.push({
				id: node.id,
				parentId,
				name: node.name,
				definition: node.definition,
				memo: node.memo ?? '',
				color: branchColor,
				position: null,
				kind,
				minValue: kind === 'score' ? (node.min ?? DEFAULT_SCORE_MIN) : null,
				maxValue: kind === 'score' ? (node.max ?? DEFAULT_SCORE_MAX) : null
			});
			if (node.children) walk(node.children, node.id, branchColor);
		});
	};
	walk(outline, null, DEFAULT_PALETTE[0]);
	return codes;
}
