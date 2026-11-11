import type { CollaboratorRole, FolderWithProjectsPublic } from '$lib/api';

/**
 * What the reader may do in a folder, worked out from its collaborators. Only
 * used to leave actions out of the UI: the API checks for itself.
 */

/** The page's signed-in user, as far as these checks need it. */
export type Reader = { id: string; scope?: string | null } | null | undefined;

/** The roles from least to most, so a role's index says how much it grants. */
export const ROLES: CollaboratorRole[] = ['viewer', 'annotator', 'editor', 'admin'];

export const ROLE_ITEMS = ROLES.map((role) => ({
	value: role,
	label: role.charAt(0).toUpperCase() + role.slice(1)
}));

/** Whether role `a` grants no more than role `b`. */
export function roleAtMost(a: CollaboratorRole, b: CollaboratorRole): boolean {
	return ROLES.indexOf(a) <= ROLES.indexOf(b);
}

/** The reader's role on a folder; platform admins count as its admins. */
export function folderRoleOf(folder: FolderWithProjectsPublic, user: Reader): CollaboratorRole {
	if (user?.scope === 'admin') return 'admin';
	return (folder.collaborators ?? []).find((c) => c.user.id === user?.id)?.role ?? 'viewer';
}

/**
 * Whether the reader may archive in this folder: its admins, and platform
 * admins, who pass every role check.
 */
export function canArchive(folder: FolderWithProjectsPublic, user: Reader): boolean {
	return !!user && folderRoleOf(folder, user) === 'admin';
}

/** Whether the reader collaborates on the folder, and so can leave it. */
export function isCollaborator(folder: FolderWithProjectsPublic, user: Reader): boolean {
	return (folder.collaborators ?? []).some((c) => c.user.id === user?.id);
}
