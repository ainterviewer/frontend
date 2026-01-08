class NotificationPopup extends HTMLElement {
	constructor() {
		super();
		this.isHovered = false;
	}

	connectedCallback() {
		const shadow = this.attachShadow({ mode: 'open' });
		const timeout = this.getAttribute('timeout') ?? 3000;
		const type = this.hasAttribute('success')
			? 'success'
			: this.hasAttribute('error')
				? 'error'
				: this.hasAttribute('warning')
					? 'warning'
					: this.hasAttribute('info')
						? 'info'
						: '';

		shadow.innerHTML = `
      <style>
        :host {
          min-height: 80px;
          width: 300px;
          background-color: #f9f9f9;
          border: 1px solid #d4d4d4;
          border-left: 8px solid #d4d4d4;
          color: #333;
          display: block;
          font-family: system-ui, sans-serif;
          font-size: 0.8rem;
          margin-bottom: 24px;
          padding: 8px 16px;
          position: fixed;
          bottom: 0;
          right: -100%;
          transition: right 0.5s ease-in-out;
          z-index: 9999;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        :host(.visible) {
          right: 24px;
        }

        :host([success]) {
          background-color: #e6f7f0;
          border-color: #36b37e;
          color: #006644;
        }

        :host([error]) {
          background-color: #ffebee;
          border-color: #ff5252;
          color: #c62828;
        }

        :host([warning]) {
          background-color: #fff8e1;
          border-color: #ffab00;
          color: #ff8f00;
        }

        :host([info]) {
          background-color: #e3f2fd;
          border-color: #2196f3;
          color: #0d47a1;
        }

        ::slotted([slot="title"]) {
          margin-top: 8px;
          margin-bottom: 4px;
          font-weight: bold;
        }

        code {
          background-color: #f0f0f0;
          font-family: monospace;
          font-size: 0.9em;
          padding: 2px 4px;
        }
      </style>
      <div class="notification-content">
        <slot name="title"></slot>
        <slot name="body"></slot>
        <slot></slot>
      </div>
    `;

		// Make visible after a brief delay
		requestAnimationFrame(() => {
			this.classList.add('visible');
		});

		if (timeout) {
			const hideNotification = () => {
				if (!this.isHovered) {
					this.classList.remove('visible');
					setTimeout(() => this.remove(), 500);
				}
			};

			let timeoutId = setTimeout(hideNotification, parseInt(timeout, 10));

			this.addEventListener('mouseenter', () => {
				this.isHovered = true;
				clearTimeout(timeoutId);
			});

			this.addEventListener('mouseleave', () => {
				this.isHovered = false;
				timeoutId = setTimeout(hideNotification, 500);
			});
		}
	}
}

customElements.define('notification-popup', NotificationPopup);
