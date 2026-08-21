import type { MessagePublic } from '$lib/api';

/** Websocket close code the backend uses when the `interview_token` cookie is
 *  missing or no longer decodes. The handshake is accepted first precisely so
 *  this code can reach us: a rejected handshake arrives as an opaque error with
 *  no status, which is indistinguishable from the server being unreachable.
 *  Keep in sync with `WS_UNAUTHORIZED` in `app/api/websockets/auth.py`. */
export const WS_UNAUTHORIZED = 4401;
export type SurveyItemUnion = NonNullable<MessagePublic['survey_item']>;
export type MessageType = 'sent' | 'received' | 'system';

export interface Message {
	id?: string | number;
	text?: string;
	type: MessageType;
	message_id?: number | string;
	skipped_by_condition?: boolean;
	feedback?: 'positive' | 'negative' | null;
	survey_item?: SurveyItemUnion | null;
	image?: { data: string; alt?: string; primer?: string };
	audio?: { blob: Blob; duration: number };
	/** Server-side recording a transcribed voice message came from. */
	audio_file?: string | null;
	can_answer?: boolean;
	user_image?: boolean;
	question_label?: string;
	section?: number | null;
	// For survey responses or other internal use
	options?: unknown;
	required?: boolean;
	answer?: string;
}
