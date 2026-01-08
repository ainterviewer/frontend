/**
 * Multi-handle range slider input Web Component
 * A self-contained custom element that creates a slider with multiple handles
 *
 * Usage:
 * <multi-slider
 *   min="0"
 *   max="100"
 *   step="1"
 *   values="[0, 100]"
 *   point-radius="15"
 *   rail-height="5"
 *   track-height="5"
 *   points-color="rgb(25, 118, 210)"
 *   rail-color="rgba(25, 118, 210, 0.4)"
 *   tracks-color="rgb(25, 118, 210)"
 * ></multi-slider>
 */
class RangeSlider extends HTMLElement {
	constructor() {
		super();

		// Create the shadow DOM
		const shadow = this.attachShadow({ mode: 'open' });

		// Add styles to shadow DOM
		const style = document.createElement('style');
		style.textContent = `
      .range-slider__container {
        position: relative;
      }

      .range-slider__container span {
        display: inline-block;
      }

      .range-slider__rail {
        width: 100%;
        position: absolute;
        transform: translateY(-50%);
        left: 0;
        cursor: pointer;
      }

      .range-slider__track {
        position: absolute;
        transform: translateY(-50%);
        cursor: pointer;
      }

      .range-slider__point {
        top: 0;
        transform: translateX(-50%);
        position: absolute;
        border-radius: 50%;
        cursor: pointer;
        transition: box-shadow 150ms;
      }

      .range-slider__container .range-slider__tooltip {
        min-width: 30px;
        font-size: 16px;
        padding: 0.3em 0.6em;
        background-color: gray;
        color: white;
        position: absolute;
        left: 0;
        top: -100%;
        text-align: center;
        border-radius: 3px;
        user-select: none;
        transform: translate(-50%, -50%) scale(0);
        transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
        z-index: 10;
      }

      .range-slider__container .range-slider__tooltip::after {
        content: "";
        background-color: gray;
        width: 1em;
        height: 1em;
        position: absolute;
        bottom: -5px;
        transform: translate(-50%) rotate(45deg);
        left: 50%;
        z-index: -1;
      }
    `;
		shadow.appendChild(style);

		// Create container div
		const container = document.createElement('div');
		container.classList.add('range-slider');
		shadow.appendChild(container);

		// get attribute values from getters
		const values = this.values;
		const step = this.step;
		const minLength = this.minLength;
		const maxLength = this.maxLength;
		const pointsColor = this.pointsColor;
		const railColor = this.railColor;
		const tracksColor = this.tracksColor;
		const pointRadius = this.pointRadius;
		const railHeight = this.railHeight;
		const trackHeight = this.trackHeight;

		this.defaultProps = {
			values: values,
			step: step,
			min: minLength,
			max: maxLength,
			colors: {
				points: pointsColor,
				rail: railColor,
				tracks: tracksColor
			},
			pointRadius,
			railHeight,
			trackHeight
		};

		this.allProps = {
			...this.defaultProps,
			values: [...this.defaultProps.values],
			colors: {
				...this.defaultProps.colors
			}
		};

		this.container = this.initContainer('.range-slider');
		this.pointPositions = this.generatePointPositions();
		this.possibleValues = this.generatePossibleValues();
		this.jump =
			this.container.offsetWidth /
			Math.ceil((this.allProps.max - this.allProps.min) / this.allProps.step);

		this.rail = this.initRail();
		this.tracks = this.initTracks(this.allProps.values.length - 1);
		this.tooltip = this.initTooltip();
		this.points = this.initPoints(this.allProps.values.length);

		this.drawScene();

		this.selectedPointIndex = -1;
		this.changeHandlers = [];

		// binding methods
		this.onChange = this.onChange.bind(this);
		this.draw = this.draw.bind(this);
		this.railClickHandler = this.railClickHandler.bind(this);
		this.documentMouseupHandler = this.documentMouseupHandler.bind(this);
		this.documentMouseMoveHandler = this.documentMouseMoveHandler.bind(this);
		this.pointClickHandler = this.pointClickHandler.bind(this);
		this.pointMouseoverHandler = this.pointMouseoverHandler.bind(this);
		this.pointMouseOutHandler = this.pointMouseOutHandler.bind(this);
		this.resizeHandler = this.resizeHandler.bind(this);
	}

	// fires after the element has been attached to the DOM
	connectedCallback() {
		// Recalculate dimensions after component is connected to DOM
		setTimeout(() => {
			this.pointPositions = this.generatePointPositions();
			this.jump =
				this.container.offsetWidth /
				Math.ceil((this.allProps.max - this.allProps.min) / this.allProps.step);
			this.draw();
		}, 0);

		// Handle window resize
		window.addEventListener('resize', this.resizeHandler);
	}

	disconnectedCallback() {
		window.removeEventListener('resize', this.resizeHandler);
	}

	resizeHandler() {
		this.pointPositions = this.generatePointPositions();
		this.jump =
			this.container.offsetWidth /
			Math.ceil((this.allProps.max - this.allProps.min) / this.allProps.step);
		this.draw();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;

		switch (name) {
			case 'values':
				this.allProps.values = JSON.parse(newValue);
				this.pointPositions = this.generatePointPositions();
				this.draw();
				break;
			case 'min':
				this.allProps.min = parseInt(newValue) || 0;
				this.possibleValues = this.generatePossibleValues();
				this.pointPositions = this.generatePointPositions();
				this.draw();
				break;
			case 'max':
				this.allProps.max = parseInt(newValue) || 100;
				this.possibleValues = this.generatePossibleValues();
				this.pointPositions = this.generatePointPositions();
				this.draw();
				break;
			case 'step':
				this.allProps.step = parseInt(newValue) || 1;
				this.possibleValues = this.generatePossibleValues();
				this.jump =
					this.container.offsetWidth /
					Math.ceil((this.allProps.max - this.allProps.min) / this.allProps.step);
				this.draw();
				break;
		}
	}

	static get observedAttributes() {
		return ['values', 'min', 'max', 'step'];
	}

	get minLength() {
		return parseInt(this.getAttribute('min')) || 0;
	}

	get maxLength() {
		return parseInt(this.getAttribute('max')) || 100;
	}

	get step() {
		return parseInt(this.getAttribute('step')) || 1;
	}

	get values() {
		return JSON.parse(this.getAttribute('values') || '[0, 100]');
	}

	get pointRadius() {
		return parseInt(this.getAttribute('point-radius')) || 10;
	}

	get railHeight() {
		return parseInt(this.getAttribute('rail-height')) || 5;
	}

	get trackHeight() {
		return parseInt(this.getAttribute('track-height')) || 5;
	}

	get pointsColor() {
		return this.getAttribute('points-color') || 'rgb(25, 118, 210)';
	}

	get railColor() {
		return this.getAttribute('rail-color') || 'rgba(25, 118, 210, 0.4)';
	}

	get tracksColor() {
		return this.getAttribute('tracks-color') || 'rgb(25, 118, 210)';
	}

	/**
	 * Draw all elements with initial positions
	 */
	drawScene() {
		this.container.classList.add('range-slider__container');
		this.container.style.height = this.allProps.pointRadius * 2 + 'px';
		this.container.appendChild(this.rail);
		this.container.appendChild(this.tooltip);

		this.tracks.forEach((track) => this.container.appendChild(track));
		this.points.forEach((point) => this.container.appendChild(point));
	}

	generatePointPositions() {
		return this.allProps.values.map((value) => {
			let percentage =
				((value - this.allProps.min) / (this.allProps.max - this.allProps.min)) * 100;
			return Math.floor((percentage / 100) * this.container.offsetWidth);
		});
	}

	/**
	 * Generate all values that can slider have starting from min, to max increased by step
	 */
	generatePossibleValues() {
		let values = [];

		for (let i = this.allProps.min; i <= this.allProps.max; i += this.allProps.step) {
			values.push(Math.round(i * 100) / 100);
		}

		if (this.allProps.max % this.allProps.step > 0) {
			values.push(Math.round(this.allProps.max * 100) / 100);
		}

		return values;
	}

	/**
	 * Initialize container
	 * @param  {string} selector
	 */
	initContainer(selector) {
		const container = this.shadowRoot.querySelector(selector);
		container.classList.add('range-slider__container');
		container.style.height = this.allProps.pointRadius * 2 + 'px';
		return container;
	}

	/**
	 * Initialize Rail
	 */
	initRail() {
		const rail = document.createElement('span');
		rail.classList.add('range-slider__rail');

		rail.style.background = this.allProps.colors.rail;
		rail.style.height = this.allProps.railHeight + 'px';
		rail.style.top = this.allProps.pointRadius + 'px';

		rail.addEventListener('click', (e) => this.railClickHandler(e));
		return rail;
	}

	/**
	 * Initialize all tracks (equal to number of points - 1)
	 * @param  {number} count
	 */
	initTracks(count) {
		let tracks = [];
		for (let i = 0; i < count; i++) {
			tracks.push(this.initTrack(i));
		}
		return tracks;
	}

	/**
	 * Initialize single track at specific index position
	 * @param  {number} index
	 */
	initTrack(index) {
		const track = document.createElement('span');
		track.classList.add('range-slider__track');
		let trackPointPositions = this.pointPositions.slice(index, index + 2);

		track.style.left = Math.min(...trackPointPositions) + 'px';
		track.style.top = this.allProps.pointRadius + 'px';
		track.style.width = Math.max(...trackPointPositions) - Math.min(...trackPointPositions) + 'px';
		track.style.height = this.allProps.trackHeight + 'px';

		let trackColors = this.allProps.colors.tracks;
		track.style.background = Array.isArray(trackColors)
			? trackColors[index] || trackColors[trackColors.length - 1]
			: trackColors;

		track.addEventListener('click', (e) => this.railClickHandler(e));
		return track;
	}

	/**
	 * Initialize all points (equal to number of values)
	 * @param  {number} count
	 */
	initPoints(count) {
		let points = [];
		for (let i = 0; i < count; i++) {
			points.push(this.initPoint(i));
		}
		return points;
	}

	/**
	 * Initialize single point at specific index position
	 * @param  {number} index
	 */
	initPoint(index) {
		const point = document.createElement('span');
		point.classList.add('range-slider__point');

		point.style.width = this.allProps.pointRadius * 2 + 'px';
		point.style.height = this.allProps.pointRadius * 2 + 'px';
		point.style.left = `${(this.pointPositions[index] / this.container.offsetWidth) * 100}%`;

		let pointColors = this.allProps.colors.points;
		point.style.background = Array.isArray(pointColors)
			? pointColors[index] || pointColors[pointColors.length - 1]
			: pointColors;

		point.addEventListener('mousedown', (e) => this.pointClickHandler(e, index));
		point.addEventListener('mouseover', (e) => this.pointMouseoverHandler(e, index));
		point.addEventListener('mouseout', (e) => this.pointMouseOutHandler(e, index));

		return point;
	}

	/**
	 * Initialize tooltip
	 */
	initTooltip() {
		const tooltip = document.createElement('span');
		tooltip.classList.add('range-slider__tooltip');
		tooltip.style.fontSize = this.allProps.pointRadius * 1.3 + 'px';
		return tooltip;
	}

	/**
	 * Draw points, tracks and tooltip (on rail click or on drag)
	 */
	draw() {
		this.points.forEach((point, i) => {
			point.style.left = `${(this.pointPositions[i] / this.container.offsetWidth) * 100}%`;
		});

		this.tracks.forEach((track, i) => {
			let trackPointPositions = this.pointPositions.slice(i, i + 2);
			track.style.left = Math.min(...trackPointPositions) + 'px';
			track.style.width =
				Math.max(...trackPointPositions) - Math.min(...trackPointPositions) + 'px';
		});

		if (this.selectedPointIndex >= 0) {
			this.tooltip.style.left = this.pointPositions[this.selectedPointIndex] + 'px';
			this.tooltip.textContent = this.allProps.values[this.selectedPointIndex] + '%';
		}
	}

	/**
	 * Redraw on rail click
	 * @param  {Event} e
	 */
	railClickHandler(e) {
		let newPosition = this.getMouseRelativePosition(e.pageX);
		let closestPositionIndex = this.getClosestPointIndex(newPosition);
		this.pointPositions[closestPositionIndex] = newPosition;

		// Update value based on position
		this.allProps.values[closestPositionIndex] =
			this.possibleValues[
				Math.min(Math.floor(newPosition / this.jump), this.possibleValues.length - 1)
			];

		this.dispatchEvent(
			new CustomEvent('rangeSliderValueChanged', {
				detail: { values: this.allProps.values },
				bubbles: true,
				composed: true
			})
		);

		this.draw();
	}

	/**
	 * Find the closest possible point position from current mouse position
	 * in order to move the point
	 * @param  {number} mousePosition
	 */
	getClosestPointIndex(mousePosition) {
		let shortestDistance = Infinity;
		let index = 0;
		for (let i in this.pointPositions) {
			let dist = Math.abs(mousePosition - this.pointPositions[i]);
			if (shortestDistance > dist) {
				shortestDistance = dist;
				index = parseInt(i);
			}
		}

		return index;
	}

	/**
	 * Stop point moving on mouse up
	 */
	documentMouseupHandler() {
		this.changeHandlers.forEach((func) => func(this.allProps.values));
		if (this.selectedPointIndex >= 0 && this.selectedPointIndex < this.points.length) {
			this.points[this.selectedPointIndex].style.boxShadow = 'none';
		}
		this.selectedPointIndex = -1;
		this.tooltip.style.transform = 'translate(-50%, -60%) scale(0)';
		document.removeEventListener('mouseup', this.documentMouseupHandler);
		document.removeEventListener('mousemove', this.documentMouseMoveHandler);
	}

	/**
	 * Start point moving on mouse move
	 * @param {Event} e
	 */
	documentMouseMoveHandler(e) {
		if (this.selectedPointIndex < 0 || this.selectedPointIndex >= this.points.length) {
			return;
		}

		let newPosition = this.getMouseRelativePosition(e.pageX);
		let extra = Math.floor(newPosition % this.jump);
		if (extra > this.jump / 2) {
			newPosition += this.jump - extra;
		} else {
			newPosition -= extra;
		}
		if (newPosition < 0) {
			newPosition = 0;
		} else if (newPosition > this.container.offsetWidth) {
			newPosition = this.container.offsetWidth;
		}
		this.pointPositions[this.selectedPointIndex] = newPosition;

		// Calculate the index in possibleValues based on position
		const valueIndex = Math.min(
			Math.floor(newPosition / this.jump),
			this.possibleValues.length - 1
		);

		this.allProps.values[this.selectedPointIndex] = this.possibleValues[valueIndex];

		this.dispatchEvent(
			new CustomEvent('rangeSliderValueChanged', {
				detail: { values: this.allProps.values },
				bubbles: true,
				composed: true
			})
		);

		this.draw();
	}

	/**
	 * Register document listeners on point click
	 * and save clicked point index
	 * @param {Event} e
	 */
	pointClickHandler(e, index) {
		e.preventDefault();
		this.selectedPointIndex = index;
		document.addEventListener('mouseup', this.documentMouseupHandler);
		document.addEventListener('mousemove', this.documentMouseMoveHandler);
	}

	/**
	 * Point mouse over box shadow and tooltip displaying
	 * @param {Event} e
	 * @param {number} index
	 */
	pointMouseoverHandler(e, index) {
		const color = this.points[index].style.backgroundColor || this.pointsColor;
		const transparentColor = RangeSlider.addTransparencyToColor(color, 16);

		if (this.selectedPointIndex < 0) {
			this.points[index].style.boxShadow = `0px 0px 0px ${Math.floor(
				this.allProps.pointRadius / 1.5
			)}px ${transparentColor}`;
		}
		this.tooltip.style.transform = 'translate(-50%, -60%) scale(1)';
		this.tooltip.style.left = this.pointPositions[index] + 'px';
		this.tooltip.textContent = this.allProps.values[index] + '%';
	}

	/**
	 * Add transparency for rgb, rgba or hex color
	 * @param {string} color
	 * @param {number} percentage
	 */
	static addTransparencyToColor(color, percentage) {
		if (!color) return 'rgba(25, 118, 210, 0.16)'; // Default fallback

		if (color.startsWith('rgba')) {
			return color.replace(/(\d+)(?!.*\d)/, percentage + '%');
		}

		if (color.startsWith('rgb')) {
			let newColor = color.replace(/(\))(?!.*\))/, `, ${percentage}%)`);
			return newColor.replace('rgb', 'rgba');
		}

		if (color.startsWith('#')) {
			// Proper hex to rgba conversion
			const r = parseInt(color.slice(1, 3), 16);
			const g = parseInt(color.slice(3, 5), 16);
			const b = parseInt(color.slice(5, 7), 16);
			return `rgba(${r}, ${g}, ${b}, ${percentage / 100})`;
		}

		return color;
	}

	/**
	 * Hide shadow and tooltip on mouse out
	 * @param {Event} e
	 * @param {number} index
	 */
	pointMouseOutHandler(e, index) {
		if (this.selectedPointIndex < 0) {
			this.points[index].style.boxShadow = 'none';
			this.tooltip.style.transform = 'translate(-50%, -60%) scale(0)';
		}
	}

	/**
	 * Get mouse position relatively from containers left position on the page
	 */
	getMouseRelativePosition(pageX) {
		const rect = this.container.getBoundingClientRect();
		return pageX - rect.left - window.scrollX;
	}

	/**
	 * Register onChange callback to call it on slider move end passing all the present values
	 */
	onChange(func) {
		if (typeof func !== 'function') {
			throw new Error('Please provide function as onChange callback');
		}
		this.changeHandlers.push(func);
		return this;
	}
}

// Define the custom element
customElements.define('multi-slider', RangeSlider);
