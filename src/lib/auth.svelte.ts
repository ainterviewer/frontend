import type { Scope } from '$lib/api';

class AuthState {
	user = $state<{ scope: Scope } | null>(null);

	get isAdmin() {
		return this.user?.scope === 'admin';
	}

	setUser(user: { scope: Scope } | null) {
		this.user = user;
	}
}

export const auth = new AuthState();
