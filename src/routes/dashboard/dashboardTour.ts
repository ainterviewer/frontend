import 'driver.js/dist/driver.css';

import { driver } from 'driver.js';

import { addSkipOnboardingButton, PREVIEW_BADGE, tourSteps } from '$lib/onboarding';

// The steps a user who took the tour before steps had ids has seen.
const LEGACY_TOUR_STEPS = [
	'welcome',
	'header-menu',
	'header-profile',
	'home',
	'experiments',
	'new-folder',
	'new-project',
	'documentation',
	'done'
];

/** Open or close the header's dropdown menu, which holds the `header-*` steps. */
function setHeaderMenuOpen(open: boolean) {
	const visible = !!document.querySelector('[data-tour="header-menu-dropdown"].visible');
	if (visible !== open) {
		(document.querySelector('[data-tour="header-menu"]') as HTMLElement | null)?.click();
	}
}

/**
 * The dashboard's guided tour: the whole tour on a first visit, then only the
 * steps added since; nothing if the user opted out of all tours. Steps point
 * at `data-tour` attributes on the dashboard, the header and the sidebar.
 *
 * `safetyCheck`: whether to mention the safety check, a preview feature, so
 * only users who have it hear about it.
 */
export function startDashboardTour(safetyCheck: boolean) {
	const steps = tourSteps(
		'dashboard',
		[
			{
				id: 'welcome',
				popover: {
					title: 'Welcome to the AInterviewer Platform 👋',
					description:
						"This interactive tour will guide you through the platform's features, and help you get started. Navigate the tour with the buttons below or with the arrow keys on your keyboard."
				}
			},
			{
				id: 'header-menu',
				element: '[data-tour="header-menu-container"]',
				popover: {
					title: 'Global Menu',
					description: 'In the global dropdown menu you can logout at any time.'
				}
			},
			{
				id: 'header-profile',
				element: '[data-tour="header-profile"]',
				popover: {
					title: 'Your Profile',
					description:
						'In <u>Your profile</u> you can edit your user information, and manage how you see these interactive tours.',
					side: 'left'
				}
			},
			{
				id: 'header-flagged',
				element: '[data-tour="header-flagged"]',
				popover: {
					title: 'Flagged Messages',
					description:
						"Counts the flagged messages you haven't read yet. While there are any, a dot shows on your avatar.",
					side: 'left'
				}
			},
			{
				id: 'header-whats-new',
				element: '[data-tour="header-whats-new"]',
				popover: {
					title: "What's New",
					description:
						'Read about recent changes to the platform. A dot here, and on your avatar, means there is a release you have not seen yet.',
					side: 'left'
				}
			},
			{
				id: 'home',
				element: '[data-tour="sidebar-home"]',
				popover: {
					title: 'Home',
					description:
						'<u>Home</u> is where your projects live. Organize your projects under folders and see the status of individual each project.'
				}
			},
			{
				id: 'experiments',
				element: '[data-tour="sidebar-experiments"]',
				popover: {
					title: 'Experiments',
					description:
						'The <u>Experiments</u> tab is for an advanced feature, only useful when you have two or more projects created under the same folder. The feature allows you to assign respondents to different existing interview projects at random.'
				}
			},
			{
				id: 'flagged',
				element: '[data-tour="sidebar-flagged"]',
				popover: {
					title: 'Flagged',
					description: `<u>Flagged</u> collects the messages respondents reported${
						safetyCheck ? `, and the answers the safety check ${PREVIEW_BADGE} acted on,` : ''
					} across all your projects. Review them here, and mark them read or resolved.`
				}
			},
			{
				id: 'new-folder',
				element: '[data-tour="new-folder"]',
				popover: {
					title: 'Create a Folder',
					description: 'Folders group related projects and let you invite and manage collaborators.'
				}
			},
			{
				id: 'folder-menu',
				element: '[data-tour="folder-menu"]',
				popover: {
					title: 'Folder Menu',
					description:
						"A folder's menu is where you rename or delete it, and where you invite and manage its collaborators under <u>Collaborators</u>."
				}
			},
			{
				id: 'new-project',
				element: '[data-tour="new-project"]',
				popover: {
					title: 'Add a Project',
					description:
						'Inside a folder, you can create interview projects to get started on your interview guide and setup.'
				}
			},
			{
				id: 'organize-projects',
				element: '[data-tour="organize-projects"]',
				popover: {
					title: 'Sort and Archive',
					description:
						'Order the projects in every folder by when they were last updated, created, or by name, and flip the arrow to reverse it. Folder admins can archive a folder or project from its menu to put it away; <u>Archived</u> shows them again.'
				}
			},
			{
				id: 'documentation',
				element: '[data-tour="documentation"]',
				popover: {
					title: 'Read the Documentation',
					description:
						'Consult our documentation site for more elaborate descriptions of the platform features and best practices.',
					side: 'top'
				}
			},
			{
				id: 'done',
				popover: {
					title: "That's it for the Main Dashboard! 🎉",
					description: 'Create and view a project to get started with your own AI-led interviews.'
				}
			}
		],
		LEGACY_TOUR_STEPS
	);
	if (steps.length === 0) return;
	const tour = driver({
		showProgress: true,
		onPopoverRender: (popover) => addSkipOnboardingButton(popover, tour),
		// One hook for every step rather than one on each, so a "what's new"
		// tour that starts midway through still opens the menu and sizes the
		// highlight.
		onHighlightStarted: (_element, step, { driver }) => {
			const selector = typeof step.element === 'string' ? step.element : '';
			setHeaderMenuOpen(selector.startsWith('[data-tour="header-'));
			// Sidebar items fill the sidebar's width, so pad them as the project
			// sidebar tour does: flush, with square corners.
			const sidebar = selector.startsWith('[data-tour="sidebar-');
			driver.setConfig({
				...driver.getConfig(),
				stagePadding: sidebar ? 0 : 10,
				stageRadius: sidebar ? 0 : 5
			});
		},
		onDestroyed: () => setHeaderMenuOpen(false),
		steps
	});
	tour.drive();
}
