import { CODE_COLORS, type Code } from './codingTree';

/**
 * A worked codebook to open the canvas on.
 *
 * The page has no backend yet, and an empty canvas is a poor way to find out
 * what this screen is for: a coding tree only makes its case once there is a
 * tree, with definitions and memos on it, to move around. It is also the
 * fixture the interactions are developed against -- deep enough to have a
 * third level, wide enough that re-parenting changes the layout visibly.
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
	children?: SeedNode[];
};

const outline: SeedNode[] = [
	{
		id: 'seed-access',
		name: 'Getting in the door',
		definition:
			'Anything about reaching the service at all: booking, waiting, being turned away, giving up before contact.',
		memo: 'The widest branch so far, and probably two things — the practical business of booking versus the decision to stop trying. Watch whether "Gave up trying" keeps pulling toward the trust branch instead.',
		children: [
			{
				id: 'seed-access-booking',
				name: 'Booking and queues',
				definition:
					'Concrete mechanics of getting an appointment: phone lines, online systems, waiting lists, opening hours.',
				children: [
					{
						id: 'seed-access-booking-digital',
						name: 'Digital-only channels',
						definition:
							'Cases where the only route in was an app, a portal or a login the participant could not or would not use.',
						memo: 'Almost always co-occurs with the age or language codes. Kept separate from "Booking and queues" because the complaint is about the channel, not the wait.'
					},
					{
						id: 'seed-access-booking-hours',
						name: 'Hours versus working life',
						definition: 'Opening hours that collide with work, school runs or shift patterns.'
					}
				]
			},
			{
				id: 'seed-access-gaveup',
				name: 'Gave up trying',
				definition:
					'The participant stopped pursuing the service. Requires them to say they stopped, not merely that it was hard.',
				memo: 'Boundary case: “I would not bother again” is a disposition, not an event — code it under Expectations instead.'
			}
		]
	},
	{
		id: 'seed-trust',
		name: 'Trust',
		definition:
			'Whether the participant expects to be treated fairly and competently, and what that expectation rests on.',
		children: [
			{
				id: 'seed-trust-institutional',
				name: 'Trust in the institution',
				definition:
					'Confidence in the organisation as a system: its rules, its record-keeping, its fairness across people.'
			},
			{
				id: 'seed-trust-personal',
				name: 'Trust in the person in front of them',
				definition:
					'Confidence in a specific staff member, often stated in contrast to the institution.',
				memo: 'The “she was lovely, the system is hopeless” pattern. Worth counting how often the two are split like this — it may be the finding.'
			},
			{
				id: 'seed-trust-repair',
				name: 'Repair after a bad experience',
				definition:
					'Something the service did that restored confidence after it had been lost: an apology, a callback, a person who followed through.',
				memo: 'Thin so far (3 passages). Either the interviews are not asking for it, or it does not happen.'
			}
		]
	},
	{
		id: 'seed-expectations',
		name: 'Expectations',
		definition:
			'What the participant thought would happen, where that came from, and how it compared with what did.',
		children: [
			{
				id: 'seed-expectations-secondhand',
				name: 'Second-hand accounts',
				definition:
					'Expectations formed from what family, neighbours or online accounts said, rather than from own experience.'
			},
			{
				id: 'seed-expectations-lowered',
				name: 'Lowered expectations',
				definition: 'Explicitly expecting little, described as a way of avoiding disappointment.'
			}
		]
	},
	{
		id: 'seed-language',
		name: 'Language and comprehension',
		definition:
			'Trouble understanding, or being understood: terminology, letters, translation, the interview itself.',
		children: [
			{
				id: 'seed-language-letters',
				name: 'Official letters',
				definition: 'Written communication the participant could not act on without help.'
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
			const branchColor = parentId === null ? CODE_COLORS[index % CODE_COLORS.length] : color;
			codes.push({
				id: node.id,
				parentId,
				name: node.name,
				definition: node.definition,
				memo: node.memo ?? '',
				color: branchColor,
				position: null
			});
			if (node.children) walk(node.children, node.id, branchColor);
		});
	};
	walk(outline, null, CODE_COLORS[0]);
	return codes;
}
