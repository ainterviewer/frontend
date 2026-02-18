import type { MessagePublic } from '$lib/api';
export type SurveyItemUnion = NonNullable<MessagePublic['survey_item']>;
export type MessageType = 'sent' | 'received' | 'system';

export interface Message {
	id?: string | number;
	text?: string;
	type: MessageType;
	message_id?: number | string;
	feedback?: 'positive' | 'negative' | null;
	survey_item?: SurveyItemUnion | null;
	image?: { data: string; alt?: string; primer?: string };
	audio?: { blob: Blob; duration: number };
	can_answer?: boolean;
	user_image?: boolean;
	question_label?: string;
	section?: number | null;
	// For survey responses or other internal use
	options?: any;
	required?: boolean;
}
