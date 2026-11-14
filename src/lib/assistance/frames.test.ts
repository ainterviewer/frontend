import { describe, expect, it } from 'vitest';

import type { ChatMessage } from '$lib/api/types.gen';

import { continuesReply } from './frames';

const T1 = '2026-11-14T10:00:00+00:00';
const T2 = '2026-11-14T10:00:05+00:00';

function frame(type: ChatMessage['type'], timestamp: string, content = '{}'): ChatMessage {
	return { role: 'model', type, timestamp, content };
}

describe('continuesReply', () => {
	it('grows a reply in place', () => {
		expect(continuesReply(frame('message', T1, 'Here'), frame('message', T1, 'Here you'))).toBe(
			true
		);
	});

	it('starts a new message for a new reply', () => {
		expect(continuesReply(frame('message', T1), frame('message', T2))).toBe(false);
	});

	it('gives every generated item its own message', () => {
		expect(continuesReply(frame('question', T1), frame('question', T1))).toBe(false);
		expect(continuesReply(frame('section', T1), frame('section', T1))).toBe(false);
		expect(continuesReply(frame('message', T1), frame('question', T1))).toBe(false);
	});

	it('does not overwrite an item with text', () => {
		expect(continuesReply(frame('question', T1), frame('message', T1))).toBe(false);
	});

	it('treats an untyped message as text', () => {
		const placeholder: ChatMessage = { role: 'model', timestamp: T1, content: 'Hi' };
		expect(continuesReply(placeholder, frame('message', T1))).toBe(true);
	});
});
