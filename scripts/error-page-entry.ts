import { render } from 'svelte/server';
import ErrorPage, { type ErrorPageProps } from '../src/lib/components/ErrorPage.svelte';

type RenderProps = Required<Pick<ErrorPageProps, 'status' | 'heading' | 'description'>>;

export function renderErrorPage(props: RenderProps): string {
	const result = render(ErrorPage, { props });
	const head = 'head' in result ? (result as { head: string }).head : '';
	const body =
		'body' in result ? (result as { body: string }).body : (result as { html: string }).html;

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${props.status} - AInterviewer</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet" />
<style>html,body{margin:0;padding:0}</style>
${head}
</head>
<body>${body}</body>
</html>
`;
}

export const errorPages: Array<{ filename: string; props: RenderProps }> = [
	{
		filename: '502.html',
		props: {
			status: 502,
			heading: "We'll be right back",
			description: 'AInterviewer is temporarily unavailable. Please try again in a moment.'
		}
	}
];
