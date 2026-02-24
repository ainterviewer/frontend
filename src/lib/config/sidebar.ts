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
		label: 'Settings',
		href: '/dashboard/settings',
		icon: 'fas fa-cog'
	},
	{ type: 'separator', requiresAdmin: true },
	{
		label: 'Admin',
		icon: 'fas fa-user-shield',
		requiresAdmin: true,
		children: [
			{
				label: 'AWS',
				href: '/dashboard/admin/aws',
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
		]
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
		label: 'Setup',
		href: '/dashboard/projects/{projectId}/{languageCode}/setup',
		icon: 'fas fa-file-lines',
		children: [
			{
				label: 'Consent',
				href: '/dashboard/projects/{projectId}/{languageCode}/setup/consent',
				icon: 'fas fa-file-signature'
			},
			{
				label: 'Welcome',
				href: '/dashboard/projects/{projectId}/{languageCode}/setup/welcome',
				icon: 'fas fa-handshake'
			},
			{
				label: 'Interview Guide',
				href: '/dashboard/projects/{projectId}/{languageCode}/setup/guide',
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
		label: 'Pilot Tests',
		// href: '/dashboard/projects/{projectId}/{languageCode}/tests',
		icon: 'fas fa-flask-vial',
		children: [
			{
				label: 'Simulations',
				href: '/dashboard/projects/{projectId}/{languageCode}/tests/simulations',
				icon: 'fas fa-microchip'
			},
			{
				label: 'Test Results',
				href: '/dashboard/projects/{projectId}/{languageCode}/tests/results',
				icon: 'fas fa-comment'
			}
		]
	},
	{
		label: 'Distribute',
		href: '/dashboard/projects/{projectId}/{languageCode}/distribution',
		icon: 'fas fa-envelopes-bulk',
		children: [
			{
				label: 'Monitor',
				href: '/dashboard/projects/{projectId}/{languageCode}/distribution/monitor',
				icon: 'fa-solid fa-tower-cell'
			}
		]
	},
	{
		label: 'Interviews',
		href: '/dashboard/projects/{projectId}/{languageCode}/interviews',
		icon: 'fas fa-comments'
	},
	{
		label: 'Analysis',
		// href: '/dashboard/projects/{projectId}/{languageCode}/analysis',
		icon: 'fas fa-chart-pie',
		children: [
			{
				label: 'Annotate',
				href: '/dashboard/projects/{projectId}/{languageCode}/analysis/annotate',
				icon: 'fas fa-tags'
			}
			// FIXME:
			// {
			// 	label: 'Visualizations',
			// 	href: '/dashboard/projects/{projectId}/{languageCode}/analysis/visualizations',
			// 	icon: 'fas fa-chart-line'
			// }
		]
	},
	{
		label: 'Settings',
		href: '/dashboard/projects/{projectId}/{languageCode}/settings',
		icon: 'fas fa-gears'
	}
];
