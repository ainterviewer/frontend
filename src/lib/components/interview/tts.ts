// Plays synthesized speech for interviewer messages. The backend looks the
// message text up by id within the participant's interview (cookie auth) and
// streams back an MP3.
//
// Messages are queued and played one at a time, in the order they were
// enqueued; stop() drops the queue and silences the current playback.
export class TtsPlayer {
	private audio: HTMLAudioElement | null = null;
	private url: string | null = null;
	private queue: number[] = [];
	private draining = false;
	// Resolves the in-progress playOne() when playback ends or is torn down.
	private finishCurrent: (() => void) | null = null;
	// Invalidates the drain loop and in-flight fetches when stop() supersedes them.
	private generation = 0;

	enqueue(messageId: number) {
		this.queue.push(messageId);
		if (!this.draining) void this.drain();
	}

	stop() {
		this.generation++;
		this.queue = [];
		this.draining = false;
		this.teardown();
	}

	private async drain() {
		this.draining = true;
		const generation = this.generation;
		while (this.queue.length > 0 && generation === this.generation) {
			const messageId = this.queue.shift()!;
			try {
				await this.playOne(messageId, generation);
			} catch (e) {
				console.error('TTS playback failed', e);
			}
		}
		if (generation === this.generation) this.draining = false;
	}

	private async playOne(messageId: number, generation: number): Promise<void> {
		const res = await fetch('/api/speech', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message_id: messageId })
		});
		if (!res.ok) throw new Error(`Speech synthesis failed (${res.status})`);
		const blob = await res.blob();
		if (generation !== this.generation) return; // stopped while fetching

		// Resolves on natural end, playback error, or teardown via stop() —
		// the queue must keep moving in every case.
		await new Promise<void>((resolve) => {
			this.finishCurrent = resolve;
			this.url = URL.createObjectURL(blob);
			this.audio = new Audio(this.url);
			this.audio.onended = () => this.teardown();
			this.audio.onerror = () => this.teardown();
			this.audio.play().catch(() => this.teardown());
		});
	}

	private teardown() {
		this.audio?.pause();
		this.audio = null;
		if (this.url) {
			URL.revokeObjectURL(this.url);
			this.url = null;
		}
		const finish = this.finishCurrent;
		this.finishCurrent = null;
		finish?.();
	}
}
