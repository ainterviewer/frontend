import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Autosaver, saveContent, type SaveResult, saveRevisioned } from './autosave.svelte';

// Autosaving with real reactive state: a page's `$state`, watched by an
// effect, saved a second after the last change.

type Page = { text: string };

function setup(save: (value: Page, overwrite?: number) => Promise<SaveResult>, queue?: string) {
	const page = $state<Page>({ text: 'loaded' });
	let saver!: Autosaver<Page>;
	const stop = $effect.root(() => {
		saver = new Autosaver({ read: () => ({ ...page }), save, queue });
		saver.watch();
	});
	flushSync();
	return { page, saver, stop };
}

const ok = async (_value: Page): Promise<SaveResult> => ({ ok: true });

describe('Autosaver', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('saves a second after the last change, not on load', async () => {
		const save = vi.fn(ok);
		const { page, saver, stop } = setup(save);
		await vi.advanceTimersByTimeAsync(2000);
		expect(save).not.toHaveBeenCalled();

		page.text = 'edited';
		flushSync();
		expect(saver.state).toBe('pending');
		await vi.advanceTimersByTimeAsync(500);
		page.text = 'edited more';
		flushSync();
		await vi.advanceTimersByTimeAsync(1000);

		expect(save).toHaveBeenCalledTimes(1);
		expect(save.mock.calls[0][0]).toEqual({ text: 'edited more' });
		expect(saver.state).toBe('saved');
		expect(saver.unsaved).toBe(false);
		stop();
	});

	it('saves a change made while it was saving, after', async () => {
		let release!: () => void;
		const save = vi.fn(
			(_value: Page) =>
				new Promise<SaveResult>((resolve) => (release = () => resolve({ ok: true })))
		);
		const { page, saver, stop } = setup(save);

		page.text = 'first';
		flushSync();
		const flushed = saver.flush();
		page.text = 'second';
		flushSync();
		release();
		await flushed;
		expect(saver.state).toBe('pending');

		await vi.advanceTimersByTimeAsync(1000);
		release();
		await vi.advanceTimersByTimeAsync(0);
		expect(save.mock.calls.map((call) => call[0].text)).toEqual(['first', 'second']);
		expect(saver.state).toBe('saved');
		stop();
	});

	it('stops on a conflict until the reader keeps their version', async () => {
		const save = vi.fn(async (_value: Page, overwrite?: number): Promise<SaveResult> =>
			overwrite === undefined ? { ok: false, conflict: 7 } : { ok: true }
		);
		const { page, saver, stop } = setup(save);

		page.text = 'mine';
		flushSync();
		expect(await saver.flush()).toBe(false);
		expect(saver.state).toBe('conflict');

		page.text = 'mine, still';
		flushSync();
		await vi.advanceTimersByTimeAsync(2000);
		expect(save).toHaveBeenCalledTimes(1);

		await saver.keepMine();
		expect(save).toHaveBeenLastCalledWith({ text: 'mine, still' }, 7);
		expect(saver.state).toBe('saved');
		stop();
	});

	it('reports why it cannot save, and tries again on the next change', async () => {
		const save = vi.fn(async (value: Page): Promise<SaveResult> =>
			value.text ? { ok: true } : { ok: false, invalid: 'Say something' }
		);
		const { page, saver, stop } = setup(save);

		page.text = '';
		flushSync();
		await saver.flush();
		expect(saver.state).toBe('invalid');
		expect(saver.message).toBe('Say something');

		page.text = 'something';
		flushSync();
		await vi.advanceTimersByTimeAsync(1000);
		expect(saver.state).toBe('saved');
		stop();
	});

	it('saves one at a time what shares a queue', async () => {
		let running = 0;
		let most = 0;
		const save = async (): Promise<SaveResult> => {
			most = Math.max(most, ++running);
			await new Promise((resolve) => setTimeout(resolve, 100));
			running--;
			return { ok: true };
		};
		const a = setup(save, 'emails');
		const b = setup(save, 'emails');

		a.page.text = 'a';
		b.page.text = 'b';
		flushSync();
		const both = Promise.all([a.saver.flush(), b.saver.flush()]);
		await vi.advanceTimersByTimeAsync(300);
		expect(await both).toEqual([true, true]);
		expect(most).toBe(1);
		a.stop();
		b.stop();
	});
});

describe('saveContent', () => {
	it('reads a stale revision as a conflict, and sends the revision to overwrite', async () => {
		const stale = await saveContent('p', 'agents', async () => ({
			error: { detail: 'stale', code: 'stale_revision', current_revision: 6 },
			response: new Response(null, { status: 412 })
		}));
		expect(stale).toEqual({ ok: false, conflict: 6 });

		const write = vi.fn(async (_headers: { 'if-match'?: string }) => ({
			response: new Response(null, { status: 200, headers: { etag: '"7"' } })
		}));
		expect(await saveContent('p', 'agents', write, 6)).toEqual({ ok: true });
		expect(write).toHaveBeenCalledWith({ 'if-match': '"6"' });
	});
});

describe('saveRevisioned', () => {
	it('saves against the revision it holds, and moves it on', async () => {
		const etag = { value: '"3"' as string | null };
		const write = vi.fn(async (_headers: { 'if-match'?: string }) => ({
			response: new Response(null, { status: 200, headers: { etag: '"4"' } })
		}));
		expect(await saveRevisioned(etag, write)).toEqual({ ok: true });
		expect(write).toHaveBeenCalledWith({ 'if-match': '"3"' });
		expect(etag.value).toBe('"4"');

		const stale = await saveRevisioned(etag, async () => ({
			error: { current_revision: 9 },
			response: new Response(null, { status: 412 })
		}));
		expect(stale).toEqual({ ok: false, conflict: 9 });
		expect(etag.value).toBe('"4"');
	});
});
