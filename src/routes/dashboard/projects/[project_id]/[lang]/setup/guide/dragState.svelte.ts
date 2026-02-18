let _draggingType = $state<'section' | 'question' | null>(null);

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
	get chatDropTarget() {
		return _chatDropTarget;
	},
	set chatDropTarget(value: ChatDropTarget) {
		_chatDropTarget = value;
	}
};
