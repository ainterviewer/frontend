// Remembers the login page's "Remember me" choice for the next sign-in.
// Not sensitive: it only pre-ticks the checkbox.
export const REMEMBER_ME_COOKIE = 'remember_me';

const ONE_YEAR = 60 * 60 * 24 * 365;

export function saveRememberMe(checked: boolean) {
	document.cookie = `${REMEMBER_ME_COOKIE}=${checked ? '1' : '0'}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}
