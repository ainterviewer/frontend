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
	// [start, end] as "HH:MM:SS" strings, or null when no downtime window is set
	ec2_downtime: [string, string] | null;
}
