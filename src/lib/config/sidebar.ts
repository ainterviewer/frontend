import type { SidebarItem } from '$lib/components/Sidebar.svelte';

export const mainSidebarItems: SidebarItem[] = [
	{
		label: 'Home',
		href: '/dashboard',
		icon: 'fas fa-house'
	},
	{ type: 'separator' },
	{
		label: 'Experiments',
		href: '/dashboard/experiments',
		icon: 'fa-solid fa-vials'
	},
	{
		label: 'Admin',
		href: '/dashboard/admin',
		icon: 'fas fa-user-shield',
		requiresAdmin: true
	},
	{
		label: 'Settings',
		href: '/dashboard/settings',
		icon: 'fas fa-cog'
	}
];

export const projectSidebarItems: SidebarItem[] = [
	{
		label: 'Home',
		href: '/dashboard',
		icon: 'fas fa-house'
	},
	{ type: 'separator' },
	{
		label: 'Interview Guide',
		href: '/dashboard/projects/{projectId}/{languageCode}/guide',
		icon: 'fas fa-file-lines',
		children: [
			{
				label: 'Consent',
				href: '/dashboard/projects/{projectId}/{languageCode}/consent',
				icon: 'fas fa-file-signature'
			},
			{
				label: 'Welcome',
				href: '/dashboard/projects/{projectId}/{languageCode}/welcome',
				icon: 'fas fa-handshake'
			},
			{
				label: 'Guide',
				href: '/dashboard/projects/{projectId}/{languageCode}/content',
				icon: 'fas fa-clipboard-question'
			}
		]
	},
	{
		label: 'Agents',
		href: '/dashboard/projects/{projectId}/{languageCode}/agents',
		icon: 'fas fa-people-group'
	},
	{
		label: 'Tests',
		href: '/dashboard/projects/{projectId}/{languageCode}/tests',
		icon: 'fas fa-flask-vial',
		children: [
			{
				label: 'Results',
				href: '/dashboard/projects/{projectId}/{languageCode}/tests/results',
				icon: 'fas fa-chart-simple'
			}
		]
	},
	{
		label: 'Distribute',
		href: '/dashboard/projects/{projectId}/{languageCode}/distribution',
		icon: 'fas fa-envelopes-bulk'
	},
	{
		label: 'Interviews',
		href: '/dashboard/projects/{projectId}/{languageCode}/interviews',
		icon: 'fas fa-comments'
	},
	{
		label: 'Analysis',
		href: '/dashboard/projects/{projectId}/{languageCode}/analysis',
		icon: 'fas fa-chart-pie',
		children: [
			{
				label: 'Annotate',
				href: '/dashboard/projects/{projectId}/{languageCode}/analysis/annotate',
				icon: 'fas fa-tags'
			},
			{
				label: 'Visualizations',
				href: '/dashboard/projects/{projectId}/{languageCode}/analysis/visualizations',
				icon: 'fas fa-chart-line'
			}
		]
	},
	{
		label: 'Settings',
		href: '/dashboard/projects/{projectId}/{languageCode}/settings',
		icon: 'fas fa-gears'
	}
];

export const adminSidebarItems: SidebarItem[] = [
	{
		label: 'Home',
		href: '/dashboard',
		icon: 'fas fa-house'
	},
	{ type: 'separator' },
	{
		label: 'AWS',
		href: '/dashboard/admin',
		icon: 'fas fa-server'
	},
	{
		label: 'Access Requests',
		href: '/dashboard/admin/access-requests',
		icon: 'fas fa-user-plus'
	},
	{
		label: 'Users',
		href: '/dashboard/admin/users',
		icon: 'fas fa-users'
	}
];
