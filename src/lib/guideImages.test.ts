import { describe, expect, it } from 'vitest';

import { interviewImageUrl, projectImageUrl, transcriptImage } from './guideImages';

const image = { type: 'image' as const, name: 'my photo#1.png', description: 'd', alt: 'A photo' };

describe('guide image URLs', () => {
	it('encodes the name, so it stays one path segment', () => {
		expect(interviewImageUrl('a/b?.png')).toBe('/api/interview/images/a%2Fb%3F.png');
		expect(projectImageUrl('p1', 'my photo#1.png')).toBe(
			'/api/projects/p1/images/my%20photo%231.png'
		);
	});
});

describe('transcriptImage', () => {
	it("loads a message's image from the project's images", () => {
		expect(transcriptImage('p1', { ...image, primer: 'Look' })).toEqual({
			src: '/api/projects/p1/images/my%20photo%231.png',
			alt: 'A photo',
			primer: 'Look'
		});
	});

	it('takes the first of a list', () => {
		expect(transcriptImage('p1', [image, { ...image, name: 'b.png' }])?.src).toBe(
			'/api/projects/p1/images/my%20photo%231.png'
		);
	});

	it('is no image without a name', () => {
		expect(transcriptImage('p1', null)).toBeUndefined();
		expect(transcriptImage('p1', [])).toBeUndefined();
		expect(transcriptImage('p1', { ...image, name: '' })).toBeUndefined();
	});
});
