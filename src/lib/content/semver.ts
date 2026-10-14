// The semantic version a publish gets, mirroring the backend's
// app/db/versioning.py: major when something interviews answered is removed or
// reshaped, minor for additions and settings, patch for text only. The server
// computes the bump; this only lets the publish dialog show what raising it
// would produce.

export type Bump = 'none' | 'patch' | 'minor' | 'major';

export const BUMPS: Bump[] = ['patch', 'minor', 'major'];

const RANK: Record<Bump, number> = { none: 0, patch: 1, minor: 2, major: 3 };

/** The bumps a publish may use: the computed one or anything above it. */
export function allowedBumps(computed: Bump): Bump[] {
	return BUMPS.filter((bump) => RANK[bump] >= RANK[computed]);
}

/** `semver` bumped by `bump`; "1.0.0" when nothing was ever published. */
export function bumped(semver: string | null | undefined, bump: Bump): string {
	if (!semver) return '1.0.0';
	const [major, minor, patch] = semver.split('.').map(Number);
	switch (bump) {
		case 'major':
			return `${major + 1}.0.0`;
		case 'minor':
			return `${major}.${minor + 1}.0`;
		case 'patch':
			return `${major}.${minor}.${patch + 1}`;
		case 'none':
			return semver;
	}
}

/**
 * The version a publish raised to `target` would get, from what the server
 * says the computed bump (`pending`) would give (`next`). A higher bump zeroes
 * everything below its own part, so applying it to `next` lands where applying
 * it to the last published version would.
 */
export function nextVersion(next: string, pending: Bump, target: Bump): string {
	return RANK[target] <= RANK[pending] ? next : bumped(next, target);
}

export const BUMP_MEANING: Record<Bump, string> = {
	major:
		'Something interviews already answered was removed or changed shape. Answers from before may not line up with answers after.',
	minor:
		'Questions or options were added, or settings changed. Every question earlier interviews answered is still asked the same way.',
	patch: 'Only text changed: wording, translations, consent, welcome or emails.',
	none: 'Nothing changed since the last publish.'
};
