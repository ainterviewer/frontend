let _draggingType = $state<'section' | 'question' | null>(null);

export const dragState = {
	get draggingType() {
		return _draggingType;
	},
	set draggingType(value: 'section' | 'question' | null) {
		_draggingType = value;
	}
};
