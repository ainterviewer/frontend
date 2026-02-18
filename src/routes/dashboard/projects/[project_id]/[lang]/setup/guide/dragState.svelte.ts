let _draggingType = $state<'section' | 'question' | null>(null);
let _keepTransitionsDisabled = $state(false);
let _draggingId = $state<string | null>(null);

export type ChatDropTarget = {
	id: string;
	targetType: 'section' | 'question';
	dragType: 'section' | 'question';
} | null;

let _chatDropTarget = $state<ChatDropTarget>(null);

export const dragState = {
	get draggingType() {
		return _draggingType;
	},
	set draggingType(value: 'section' | 'question' | null) {
		_draggingType = value;
	},
	get keepTransitionsDisabled() {
		return _keepTransitionsDisabled;
	},
	set keepTransitionsDisabled(value: boolean) {
		_keepTransitionsDisabled = value;
	},
	get draggingId() {
		return _draggingId;
	},
	set draggingId(value: string | null) {
		_draggingId = value;
	},
	get chatDropTarget() {
		return _chatDropTarget;
	},
	set chatDropTarget(value: ChatDropTarget) {
		_chatDropTarget = value;
	}
};
