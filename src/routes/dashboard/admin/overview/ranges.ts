export const RANGES = [
	{ value: '30', label: '30 days' },
	{ value: '90', label: '90 days' },
	{ value: 'all', label: 'All time' }
] as const;

export type Range = (typeof RANGES)[number]['value'];

export function parseRange(param: string | null): Range {
	return RANGES.find((r) => r.value === param)?.value ?? '90';
}
