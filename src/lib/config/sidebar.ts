export type SidebarItem = {
	label?: string;
	href?: string;
	icon?: string;
	children?: SidebarItem[];
	type?: 'link' | 'separator';
	requiresAdmin?: boolean;
	project_id?: string;
	demoFeature?: boolean;
	dataTour?: string;
};

export const mainSidebarItems: SidebarItem[] = [
	{
		label: 'Home',
		href: '/dashboard',
		icon: 'fas fa-house',
		dataTour: 'sidebar-home'
	},
	{ type: 'separator' },
	{
		label: 'Experiments',
		href: '/dashboard/experiments',
		icon: 'fa-solid fa-vials',
		dataTour: 'sidebar-experiments'
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
				label: 'Invitations',
				href: '/dashboard/admin/invitations',
				icon: 'fas fa-envelope-open-text'
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
		dataTour: 'setup',
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
		icon: 'fas fa-people-group',
		dataTour: 'agents'
	},
	{
		label: 'Pilot Interviews',
		// href: '/dashboard/projects/{projectId}/{languageCode}/tests',
		dataTour: 'pilot-interviews',
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
		dataTour: 'distribute',
		children: [
			{
				label: 'Participants',
				href: '/dashboard/projects/{projectId}/{languageCode}/distribution/participants',
				icon: 'fa-solid fa-person-circle-question',
				demoFeature: true
			},
			{
				label: 'Email',
				href: '/dashboard/projects/{projectId}/{languageCode}/distribution/email',
				icon: 'fa-solid fa-envelope-open-text',
				demoFeature: true
			},
			{
				label: 'Monitor',
				href: '/dashboard/projects/{projectId}/{languageCode}/distribution/monitor',
				icon: 'fa-solid fa-tower-cell'
			}
		]
	},
	{
		label: 'Interview Data',
		href: '/dashboard/projects/{projectId}/{languageCode}/interviews',
		icon: 'fas fa-comments',
		dataTour: 'interview-data'
	},
	// {
	// label: 'Analysis',
	// href: '/dashboard/projects/{projectId}/{languageCode}/analysis',
	// icon: 'fas fa-chart-pie',
	// dataTour: 'analysis',
	// children: [
	// 	{
	// 		label: 'Annotate',
	// 		href: '/dashboard/projects/{projectId}/{languageCode}/analysis/annotate',
	// 		icon: 'fas fa-tags'
	// 	}
	// FIXME:
	// {
	// 	label: 'Visualizations',
	// 	href: '/dashboard/projects/{projectId}/{languageCode}/analysis/visualizations',
	// 	icon: 'fas fa-chart-line'
	// }
	// ]
	// },
	{
		label: 'Settings',
		href: '/dashboard/projects/{projectId}/{languageCode}/settings',
		icon: 'fas fa-gears',
		dataTour: 'settings'
	}
];
