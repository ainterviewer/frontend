export default {
	output: {
		format: 'prettier',
		lint: 'eslint'
	},
	plugins: [
		{
			name: '@hey-api/sdk',
			asClass: true
		}
	]
};
