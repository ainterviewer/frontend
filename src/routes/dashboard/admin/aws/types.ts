export interface Instance {
	id: string;
	name: string;
	state: string;
	instance_type: string;
	model?: string;
	vllm: {
		status: string;
		models?: { name: string }[];
	};
	connections: number;
	idle_time: number;
}
