/**
A deterministic approach to generating most optimal new color
*/
export function generateColor(existingColors: string[] = []): string {
	// Convert hex to HSL (Hue, Saturation, Lightness)
	const hexToHsl = (hex: string): [number, number, number] | null => {
		const result = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
		if (!result) return null;

		const r = parseInt(result[1], 16) / 255;
		const g = parseInt(result[2], 16) / 255;
		const b = parseInt(result[3], 16) / 255;

		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const delta = max - min;
		let h = 0;
		let s = 0;
		const l = (max + min) / 2;

		if (delta !== 0) {
			s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

			if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
			else if (max === g) h = ((b - r) / delta + 2) / 6;
			else h = ((r - g) / delta + 4) / 6;
		}

		return [h * 360, s, l];
	};

	// Convert HSL to hex
	const hslToHex = (h: number, s: number, l: number): string => {
		h = h / 360;
		const hue2rgb = (p: number, q: number, t: number): number => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};

		let r: number, g: number, b: number;
		if (s === 0) {
			r = g = b = l;
		} else {
			const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			const p = 2 * l - q;
			r = hue2rgb(p, q, h + 1 / 3);
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - 1 / 3);
		}

		const toHex = (x: number): string => {
			const hex = Math.round(x * 255).toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		};

		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	};

	// Calculate perceptual color difference using CIEDE2000 approximation
	const colorDistance = (
		hsl1: [number, number, number],
		hsl2: [number, number, number]
	): number => {
		// Hue difference (circular)
		let hueDiff = Math.abs(hsl1[0] - hsl2[0]);
		if (hueDiff > 180) hueDiff = 360 - hueDiff;

		// Saturation and lightness differences
		const satDiff = Math.abs(hsl1[1] - hsl2[1]);
		const lightDiff = Math.abs(hsl1[2] - hsl2[2]);

		// Weighted distance (hue matters most for distinction)
		return hueDiff * 2 + satDiff * 100 + lightDiff * 50;
	};

	// Get existing colors in HSL
	const existingHsl: [number, number, number][] = existingColors
		.map(hexToHsl)
		.filter((color): color is [number, number, number] => color !== null);

	if (existingHsl.length === 0) {
		// First color: vibrant red
		return hslToHex(0, 0.75, 0.55);
	}

	// Strategy: Use golden angle for optimal hue distribution
	// This ensures maximum perceptual distance between colors
	const goldenAngle = 137.508; // degrees

	// Find the best hue by testing positions on the color wheel
	let bestHue = 0;
	let maxMinDistance = 0;

	// Test hues at golden angle intervals
	for (let i = 0; i < existingHsl.length + 1; i++) {
		const testHue = (existingHsl[0][0] + goldenAngle * i) % 360;

		// Vary saturation and lightness for even more distinction
		const saturation = 0.65 + (i % 3) * 0.1; // 0.65, 0.75, 0.85
		const lightness = 0.5 + (i % 2) * 0.1; // 0.50, 0.60

		const testColor: [number, number, number] = [testHue, saturation, lightness];

		// Find minimum distance to any existing color
		const minDistance = Math.min(
			...existingHsl.map((existing) => colorDistance(testColor, existing))
		);

		if (minDistance > maxMinDistance) {
			maxMinDistance = minDistance;
			bestHue = testHue;
		}
	}

	// If we have many colors, also try complementary colors
	if (existingHsl.length >= 6) {
		// Test complementary positions (180° opposite)
		existingHsl.forEach((existing) => {
			const complementaryHue = (existing[0] + 180) % 360;
			const testColor: [number, number, number] = [complementaryHue, 0.75, 0.55];

			const minDistance = Math.min(...existingHsl.map((ex) => colorDistance(testColor, ex)));

			if (minDistance > maxMinDistance) {
				maxMinDistance = minDistance;
				bestHue = complementaryHue;
			}
		});
	}

	// Vary saturation and lightness based on count for additional distinction
	const count = existingHsl.length;
	const saturation = 0.65 + (count % 3) * 0.1;
	const lightness = 0.5 + (count % 2) * 0.1;

	return hslToHex(bestHue, saturation, lightness);
}

/**
 * Calculates the best contrast color (black or white) for a given background color
 */
export function getContrastColor(hex: string): string {
	if (!hex) return '#000000';

	// Remove # if present
	const cleanHex = hex.replace('#', '');

	// Handle short hex
	const fullHex =
		cleanHex.length === 3
			? cleanHex
					.split('')
					.map((c) => c + c)
					.join('')
			: cleanHex;

	const r = parseInt(fullHex.substring(0, 2), 16);
	const g = parseInt(fullHex.substring(2, 4), 16);
	const b = parseInt(fullHex.substring(4, 6), 16);

	// Calculate luminance using YIQ formula
	const yiq = (r * 299 + g * 587 + b * 114) / 1000;

	return yiq >= 128 ? '#000000' : '#ffffff';
}
