<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Auth } from '$lib/api';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { mainSidebarItems } from '$lib/config/sidebar';
	import { enableOnboarding, isOnboardingDisabled } from '$lib/onboarding';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Profile — prefilled with the current values; intentionally not kept in
	// sync with `data` so user edits aren't clobbered.
	// svelte-ignore state_referenced_locally
	let firstName = $state(data.user?.first_name ?? '');
	// svelte-ignore state_referenced_locally
	let lastName = $state(data.user?.last_name ?? '');
	// svelte-ignore state_referenced_locally
	let organization = $state(data.user?.organization ?? '');
	let isSavingProfile = $state(false);

	// Email
	let newEmail = $state('');
	let emailPassword = $state('');
	let isSavingEmail = $state(false);

	// Password
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmNewPassword = $state('');
	let isSavingPassword = $state(false);

	// Delete account
	let deletePassword = $state('');
	let isDeleting = $state(false);

	// Onboarding — localStorage isn't reactive, so read it on mount.
	let onboardingDisabled = $state(false);
	onMount(() => {
		onboardingDisabled = isOnboardingDisabled();
	});

	function reenableOnboarding() {
		enableOnboarding();
		onboardingDisabled = false;
		toast.success('Onboarding tours reset');
	}

	const inputClass =
		'block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm transition-all focus:border-primary focus:ring-primary focus:outline-none sm:text-sm';
	const labelClass = 'block text-sm font-medium text-gray-700';
	const buttonClass =
		'rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';

	async function saveProfile(event: Event) {
		event.preventDefault();
		isSavingProfile = true;
		try {
			const { error } = await Auth.updateMe({
				body: {
					first_name: firstName.trim(),
					last_name: lastName.trim() || null,
					// The current organization is not exposed on UserPublic, so only
					// send it when the user actually entered a value.
					...(organization.trim() ? { organization: organization.trim() } : {})
				}
			});
			if (error) {
				toast.error('Failed to update profile');
			} else {
				toast.success('Profile updated');
				await invalidateAll();
			}
		} finally {
			isSavingProfile = false;
		}
	}

	async function saveEmail(event: Event) {
		event.preventDefault();
		isSavingEmail = true;
		try {
			const { error } = await Auth.updateMyEmail({
				body: { new_email: newEmail.trim(), password: emailPassword }
			});
			if (error) {
				toast.error('Failed to update email. Please check your password.');
			} else {
				toast.success('Email updated');
				newEmail = '';
				emailPassword = '';
				await invalidateAll();
			}
		} finally {
			isSavingEmail = false;
		}
	}

	async function savePassword(event: Event) {
		event.preventDefault();
		if (newPassword !== confirmNewPassword) {
			toast.error('New passwords do not match');
			return;
		}
		isSavingPassword = true;
		try {
			const { error } = await Auth.updateMyPassword({
				body: { current_password: currentPassword, new_password: newPassword }
			});
			if (error) {
				toast.error('Failed to update password. Please check your current password.');
			} else {
				toast.success('Password updated');
				currentPassword = '';
				newPassword = '';
				confirmNewPassword = '';
			}
		} finally {
			isSavingPassword = false;
		}
	}

	async function deleteAccount(event: Event) {
		event.preventDefault();
		if (
			!confirm(
				'Are you sure you want to delete your account?\n\nThis action is permanent and cannot be undone.'
			)
		) {
			return;
		}
		isDeleting = true;
		try {
			const { error } = await Auth.deleteMe({ body: { password: deletePassword } });
			if (error) {
				toast.error('Failed to delete account. Please check your password.');
			} else {
				goto(resolve('/login'));
			}
		} finally {
			isDeleting = false;
		}
	}
</script>

<Sidebar items={mainSidebarItems} />
<h1 class="page-title">Your Profile</h1>

<div class="mt-6 max-w-xl space-y-10">
	<section>
		<h2 class="text-lg font-semibold text-dark">Profile</h2>
		<form onsubmit={saveProfile} class="mt-4 space-y-4">
			<div class="flex gap-4">
				<div class="flex-1">
					<label for="first_name" class={labelClass}>First Name</label>
					<div class="mt-1">
						<input id="first_name" type="text" required bind:value={firstName} class={inputClass} />
					</div>
				</div>
				<div class="flex-1">
					<label for="last_name" class={labelClass}>
						Last Name <span class="text-gray-400">(optional)</span>
					</label>
					<div class="mt-1">
						<input id="last_name" type="text" bind:value={lastName} class={inputClass} />
					</div>
				</div>
			</div>
			<div>
				<label for="organization" class={labelClass}>
					Organization <span class="text-gray-400">(optional)</span>
				</label>
				<div class="mt-1">
					<input id="organization" type="text" bind:value={organization} class={inputClass} />
				</div>
			</div>
			<button type="submit" disabled={isSavingProfile} class={buttonClass}>
				{isSavingProfile ? 'Saving...' : 'Save profile'}
			</button>
		</form>
	</section>

	<section>
		<h2 class="text-lg font-semibold text-dark">Email</h2>
		<p class="mt-1 text-sm text-gray-500">
			Your current email is <span class="font-medium">{data.user?.email}</span>.
		</p>
		<form onsubmit={saveEmail} class="mt-4 space-y-4">
			<div>
				<label for="new_email" class={labelClass}>New Email</label>
				<div class="mt-1">
					<input
						id="new_email"
						type="email"
						autocomplete="email"
						required
						bind:value={newEmail}
						class={inputClass}
					/>
				</div>
			</div>
			<div>
				<label for="email_password" class={labelClass}>Current Password</label>
				<div class="mt-1">
					<input
						id="email_password"
						type="password"
						autocomplete="current-password"
						required
						bind:value={emailPassword}
						class={inputClass}
					/>
				</div>
			</div>
			<button type="submit" disabled={isSavingEmail} class={buttonClass}>
				{isSavingEmail ? 'Saving...' : 'Update email'}
			</button>
		</form>
	</section>

	<section>
		<h2 class="text-lg font-semibold text-dark">Password</h2>
		<form onsubmit={savePassword} class="mt-4 space-y-4">
			<div>
				<label for="current_password" class={labelClass}>Current Password</label>
				<div class="mt-1">
					<input
						id="current_password"
						type="password"
						autocomplete="current-password"
						required
						bind:value={currentPassword}
						class={inputClass}
					/>
				</div>
			</div>
			<div class="flex gap-4">
				<div class="flex-1">
					<label for="new_password" class={labelClass}>New Password</label>
					<div class="mt-1">
						<input
							id="new_password"
							type="password"
							autocomplete="new-password"
							required
							bind:value={newPassword}
							class={inputClass}
						/>
					</div>
				</div>
				<div class="flex-1">
					<label for="confirm_new_password" class={labelClass}>Confirm New Password</label>
					<div class="mt-1">
						<input
							id="confirm_new_password"
							type="password"
							autocomplete="new-password"
							required
							bind:value={confirmNewPassword}
							class={inputClass}
						/>
					</div>
				</div>
			</div>
			<button type="submit" disabled={isSavingPassword} class={buttonClass}>
				{isSavingPassword ? 'Saving...' : 'Update password'}
			</button>
		</form>
	</section>

	<section>
		<h2 class="text-lg font-semibold text-dark">Onboarding</h2>
		<p class="mt-1 text-sm text-gray-500">
			Guided tours introduce features as you navigate the app. They are currently
			<span class="font-medium">{onboardingDisabled ? 'turned off' : 'on'}</span>. Resetting turns them
			back on and replays every tour the next time you visit each page.
		</p>
		<button type="button" class="mt-4 {buttonClass}" onclick={reenableOnboarding}>
			Reset onboarding tours
		</button>
	</section>

	<section class="rounded-md border border-red-300 p-4">
		<h2 class="text-lg font-semibold text-red-700">Delete Account</h2>
		<p class="mt-1 text-sm text-gray-500">
			Permanently delete your account and all associated data. This action cannot be undone.
		</p>
		<form onsubmit={deleteAccount} class="mt-4 space-y-4">
			<div>
				<label for="delete_password" class={labelClass}>Current Password</label>
				<div class="mt-1">
					<input
						id="delete_password"
						type="password"
						autocomplete="current-password"
						required
						bind:value={deletePassword}
						class={inputClass}
					/>
				</div>
			</div>
			<button
				type="submit"
				disabled={isDeleting}
				class="rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isDeleting ? 'Deleting...' : 'Delete account'}
			</button>
		</form>
	</section>
</div>
