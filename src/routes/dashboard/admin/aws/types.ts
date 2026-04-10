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

export interface SettingsData {
	min_instances: number;
	start: boolean;
	stop: boolean;
}
