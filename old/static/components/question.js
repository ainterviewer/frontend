class QuestionElement extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		this.render();
		this.setupEventListeners();
	}

	render() {
		this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .question-extra {
          display: flex;
        }

        .question-extra > span {
          padding-left: 40px;
        }
        .probes {
          width: 100%;
        }

        .question-container {
          margin-bottom: 20px;
        }

        .probe-button-container {
          display: flex;
          justify-content: flex-end;
          align-items: center;
        }

        .question-input,
        .probe-container {
          margin-bottom: 10px;
        }

        .question-input {
          display: flex;
        }

        label {
          padding-right: 10px;
          display: inline-block;
          text-wrap: nowrap;
        }

        input {
          border: 1px solid lightgray;
          border-radius: 5px;
          padding: 5px;
          margin-right: 5px;
        }

        .question-input > input {
          width: 100%;
          padding: 5px;
        }

        .probe-container {
          display: flex;
          justify-content: flex-end;
        }

        .probe-container > input {
          width: 80%;
        }

        .question-settings {
          width: fit-content;
        }

        .question-settings > .max-probes input {
          width: 35px;
          padding: 2px;
          padding-left: 5px;
        }

        .question-button {
          min-width: 35px;
        }
    </style>
      <div class="question-container draggable thin" draggable="true">
        <div class="question-input">
          <label>Main question:</label>
          <input class="main-question" placeholder="Enter a main question">
          <button class="remove-button"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="question-extra">
          <div class="question-settings">
            <div class="max-probes">
              <label><input type="number" min="0" value="3">Max probes</label>
            </div>
            <div class="create-segue">
              <label><input type="checkbox"> Create segue</label>
            </div>
            <div class="check-if-answered">
              <label><input type="checkbox"> Check if answered</label>
            </div>
            <div class="check-if-exhausted">
              <label><input type="checkbox"> Check if exhausted</label>
            </div>
            <div class="can-answer">
              <label><input type="checkbox" checked> Can answer</label>
            </div>
            <div class="can-skip">
              <label><input type="checkbox" checked> Can skip</label>
            </div>
          </div>
          <span>Probes:</span>
          <div class="probes">
            <div class="probe-button-container">
              <button class="probe-button"><i class="fa-solid fa-circle-plus"></i> Probe</button>
            </div>
          </div>
        </div>
      </div>
    `;
	}

	setupEventListeners() {
		const removeButton = this.shadowRoot.querySelector('.remove-button');
		removeButton.addEventListener('click', () => this.remove());

		const probeButton = this.shadowRoot.querySelector('.probe-button');
		probeButton.addEventListener('click', () => this.addProbe());
	}

	addProbe() {
		const probesContainer = this.shadowRoot.querySelector('.probes');
		const probeInput = document.createElement('input');
		probeInput.type = 'text';
		probeInput.placeholder = 'Enter a probe question';
		probesContainer.insertBefore(probeInput, probesContainer.lastElementChild);
	}
}

customElements.define('question-element', QuestionElement);
