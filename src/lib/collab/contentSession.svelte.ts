import { SvelteMap } from 'svelte/reactivity';
import { removeAwarenessStates } from 'y-protocols/awareness';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import { browser } from '$app/environment';
import type { ContentError } from '$lib/api';
import { backendWsUrl } from '$lib/utils/urls';

import { docId } from './guideDoc';
import { settleColors } from './presenceColors';

// A connection to one of a project's rooms on the server -- the guide, the
// consent or the welcome page (`/ws/content/{id}/{part}`,
// `app/collab/rooms.py`): y-sync for the doc, awareness for who is here.
//
// One per project and part, shared and reference-counted
// (`acquireContentSession`), so switching the language being edited -- a
// navigation that remounts the editor -- keeps the doc and the connection
// instead of syncing again.

/** The parts of the content edited live; see `LIVE_PARTS` in `app/collab/parts.py`. */
export type LivePart = 'guide' | 'consent' | 'welcome';

/** Close codes the server ends a connection with; see `app/api/websockets/content.py`. */
const SIGNED_OUT = 4401;
const FORBIDDEN = 4403;
const DOC_MISMATCH = 4409;

/** How long a session outlives its last user, to survive a navigation. */
const LINGER_MS = 10_000;

/** Origin of the transactions this tab makes, as opposed to what the server sends. */
export const LOCAL_ORIGIN = Symbol('local');

export type PresenceUser = { id: string; name: string };

export type Peer = PresenceUser & {
	clientId: number;
	/** Settled among everyone present, so no two share one: see `settleColors`. */
	color: string;
	/** The block (question, section, `framing`, ...) they are in, if any. */
	block: string | null;
};

type ServerState = {
	server: true;
	doc_id: string;
	revision: number;
	errors: ContentError[];
	saved_at: number;
};

export type SessionStatus =
	/** Connecting, or reconnecting: nothing synced yet on this connection. */
	| 'connecting'
	| 'synced'
	/** Was synced; the connection dropped and is being retried. Edits queue. */
	| 'offline'
	/** The server refused us (signed out, no access): no retries. */
	| 'refused';

function serverUrl(projectId: string): string {
	// y-websocket appends the room name: the part.
	return backendWsUrl(`/ws/content/${projectId}`);
}

export class ContentSession {
	readonly doc = new Y.Doc();
	/** None while rendering on the server, where the session never connects. */
	readonly provider: WebsocketProvider | null = null;

	status = $state<SessionStatus>('connecting');
	/** Ever synced: whether the doc holds the content yet. */
	loaded = $state(false);
	/** The part's revision the server last saved, and why it could not. */
	revision = $state<number | null>(null);
	errors = $state<ContentError[]>([]);
	peers = $state<Peer[]>([]);
	/** Local changes the server has not saved yet: made since the server
	 * last announced a save (both timed by this tab's clock). */
	unsaved = $state(false);

	#users = 0;
	#savedAt: number | null = null;
	/** The server has announced its state: `errors` is its from then on. */
	#heard = false;
	#linger: ReturnType<typeof setTimeout> | null = null;
	/** Withdraw this tab's presence as it closes or reloads, rather than
	 * leaving the others to see it until it times out (30 s). */
	#leave = () =>
		this.provider &&
		removeAwarenessStates(this.provider.awareness, [this.doc.clientID], 'page hidden');

	constructor(
		readonly projectId: string,
		readonly part: LivePart,
		readonly user: PresenceUser
	) {
		if (!browser) return;
		const provider = new WebsocketProvider(serverUrl(projectId), part, this.doc, {
			disableBc: true,
			connect: false
		});
		this.provider = provider;

		provider.on('sync', (synced: boolean) => {
			if (!synced) return;
			// Reconnect as this lineage from now on; the server refuses (4409)
			// if the doc was reset meanwhile, rather than merging into it.
			const id = docId(this.doc);
			if (id) provider.params = { doc_id: id };
			this.status = 'synced';
			this.loaded = true;
		});
		provider.on('status', ({ status }: { status: string }) => {
			if (status === 'connected') return;
			if (this.status === 'refused') return;
			this.status = this.loaded ? 'offline' : 'connecting';
		});
		provider.on('closed', ({ code }: { code: number }) => {
			if (code === DOC_MISMATCH) {
				// This copy can no longer merge. What was not saved is lost
				// either way; a reload starts from the server's.
				location.reload();
				return;
			}
			if (code === SIGNED_OUT || code === FORBIDDEN) this.status = 'refused';
		});

		this.doc.on('update', (_update: Uint8Array, origin: unknown) => {
			if (origin === LOCAL_ORIGIN) this.unsaved = true;
		});

		const { awareness } = provider;
		awareness.setLocalStateField('user', user);
		awareness.on('change', () => this.#readAwareness());

		window.addEventListener('pagehide', this.#leave);
		provider.connect();
	}

	/** Why the part is invalid as the page was loaded with it, shown until the
	 * server says (`getContentDoc`): a page opened on an invalid doc marks its
	 * problems from the first paint rather than once synced. */
	seedErrors(errors: ContentError[]) {
		if (!this.#heard) this.errors = errors;
	}

	#readAwareness() {
		const peers: Peer[] = [];
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a local of this one read, never state
		const seen = new Set<string>();
		for (const [clientId, state] of this.provider!.awareness.getStates()) {
			if ((state as Partial<ServerState>).server) {
				const server = state as ServerState;
				if (server.saved_at !== this.#savedAt) {
					this.#savedAt = server.saved_at;
					this.unsaved = false;
				}
				this.revision = server.revision;
				this.errors = server.errors ?? [];
				this.#heard = true;
				continue;
			}
			const user = state.user as PresenceUser | undefined;
			// Not this person's own other tabs, nor a reloaded tab's last
			// presence before it is withdrawn: they are not someone else.
			if (!user || user.id === this.user.id) continue;
			// One avatar per person, however many tabs they have open.
			const block = (state.block as string | null | undefined) ?? null;
			if (seen.has(user.id)) {
				const existing = peers.find((p) => p.id === user.id);
				if (existing && block) existing.block = block;
				continue;
			}
			seen.add(user.id);
			peers.push({ id: user.id, name: user.name, clientId, block, color: '' });
		}
		// This person counts too: the others see them, and must settle alike.
		const colors = settleColors([this.user.id, ...seen]);
		for (const peer of peers) peer.color = colors.get(peer.id)!;
		this.peers = peers;
	}

	/** Tell the others which block this tab is in. */
	setBlock(block: string | null) {
		this.provider?.awareness.setLocalStateField('block', block);
	}

	acquire() {
		this.#users++;
		if (this.#linger) clearTimeout(this.#linger);
		this.#linger = null;
	}

	release() {
		if (--this.#users > 0 || !this.provider) return;
		this.setBlock(null);
		this.#linger = setTimeout(() => {
			sessions.delete(sessionKey(this.projectId, this.part));
			window.removeEventListener('pagehide', this.#leave);
			this.provider?.destroy();
			this.doc.destroy();
		}, LINGER_MS);
	}
}

// Reactive: the sidebar reads the sessions' errors (`sessionErrors`).
const sessions = new SvelteMap<string, ContentSession>();

const sessionKey = (projectId: string, part: LivePart) => `${projectId}/${part}`;

/**
 * Why each of a project's parts with a session in this tab is invalid, as
 * that session knows it: as the page that opened it was loaded, then as the
 * server announces on each save. A session lingers a while after its page
 * closes (`LINGER_MS`), and the server saves a few seconds after the last
 * edit, so this is fresher than a status fetched since. Empty on the server,
 * and for a session the server refused, which knows nothing.
 */
export function sessionErrors(projectId: string): Partial<Record<LivePart, ContentError[]>> {
	const errors: Partial<Record<LivePart, ContentError[]>> = {};
	for (const session of sessions.values()) {
		if (session.projectId === projectId && session.status !== 'refused') {
			errors[session.part] = session.errors;
		}
	}
	return errors;
}

/**
 * The session for a project's `part`, connecting it if need be. Pair with
 * `release()`.
 *
 * On the server (a full page load renders there first) it is one of its own,
 * never connected and never shared between requests: the page renders what
 * it was loaded with, read-only, as it does before a sync.
 *
 * `errors` are the part's as the page was loaded (`getContentDoc`), kept
 * until the server announces its own.
 */
export function acquireContentSession(
	projectId: string,
	part: LivePart,
	user: PresenceUser,
	errors?: ContentError[]
): ContentSession {
	let session: ContentSession;
	if (!browser) session = new ContentSession(projectId, part, user);
	else {
		const key = sessionKey(projectId, part);
		const known = sessions.get(key);
		session = known ?? new ContentSession(projectId, part, user);
		if (!known) sessions.set(key, session);
		session.acquire();
	}
	if (errors) session.seedErrors(errors);
	return session;
}

export function presenceUser(user: {
	id: string;
	first_name: string;
	last_name?: string | null;
}): PresenceUser {
	return {
		id: user.id,
		name: [user.first_name, user.last_name].filter(Boolean).join(' ')
	};
}
