class SidebarState {
	collapsed = $state(false);

	toggle() {
		this.collapsed = !this.collapsed;
	}
}

export const sidebar = new SidebarState();
