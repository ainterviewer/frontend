class LoadingOverlay extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });

		const wrapper = document.createElement('div');
		wrapper.style.position = 'fixed';
		wrapper.style.top = '0';
		wrapper.style.left = '0';
		wrapper.style.width = '100vw';
		wrapper.style.height = '100vh';
		wrapper.style.background = 'rgba(0,0,0,0.4)';
		wrapper.style.display = 'flex';
		wrapper.style.justifyContent = 'center';
		wrapper.style.alignItems = 'center';
		wrapper.style.zIndex = '9999';
		wrapper.innerHTML = `<div class="spinner"></div>`;

		const style = document.createElement('style');
		style.textContent = `
      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;

		this.shadowRoot.append(style, wrapper);
	}

	close() {
		if (this.isConnected) {
			this.remove();
		}
	}

	static createFor({ duration, promise } = {}) {
		const overlay = document.createElement('loading-overlay');

		// Append to body for full-screen coverage
		document.body.appendChild(overlay);

		if (typeof duration === 'number' && duration > 0) {
			overlay._durationTimer = setTimeout(() => overlay.close(), duration);
		}

		if (promise instanceof Promise) {
			promise.finally(() => overlay.close());
		}

		return overlay;
	}
}

customElements.define('loading-overlay', LoadingOverlay);
