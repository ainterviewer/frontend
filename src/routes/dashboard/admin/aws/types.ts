export interface Instance {
	id: string;
	name: string;
	state: string;
	instance_type: string;
	model?: string;
	// Which pool the instance belongs to, from its `Service` tag: 'llm',
	// 'embedding', and whatever the proxy grows next.
	service: string;
	// Health of whichever inference server this pool runs -- vLLM, TEI, ...
	server: {
		status: string;
		models?: { name: string }[];
	};
	connections: number;
	idle_time: number;
}

/** The tunable settings of one pool. Field names match the proxy's own. */
export interface PoolSettings {
	min_instances_running: number;
	max_instances: number | null;
	start_check: boolean;
	stop_check: boolean;
	// [start, end] as "HH:MM:SS" strings, or null when no downtime window is set
	downtime: [string, string] | null;
}

/** Settings for every pool, keyed by service name. */
export type SettingsByService = Record<string, PoolSettings>;

/**
 * A partial update. A field left out keeps whatever each pool already had,
 * which is what makes it safe to apply one form to several pools at once.
 * `downtime: null` is an explicit "no window", distinct from omitting it.
 */
export interface PoolSettingsPatch {
	min_instances_running?: number;
	start_check?: boolean;
	stop_check?: boolean;
	downtime?: [string, string] | null;
}
