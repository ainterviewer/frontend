export default {
	output: {
		format: 'prettier',
		lint: 'eslint'
	},
	plugins: [
		{
			name: '@hey-api/sdk',
			operations: { strategy: 'byTags' }
		},
		'@hey-api/typescript',
		'zod'
	]
};
