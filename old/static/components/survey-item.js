// First, create a FontAwesome loader component that will handle the stylesheet
class FontAwesomeLoader extends HTMLElement {
  constructor() {
    super();
    if (!document.querySelector("#font-awesome-stylesheet")) {
      const link = document.createElement("link");
      link.id = "font-awesome-stylesheet";
      link.rel = "stylesheet";
      link.href = "https://use.fontawesome.com/releases/v6.6.0/css/all.css";
      document.head.appendChild(link);
    }
  }
}

customElements.define("font-awesome-loader", FontAwesomeLoader);

class SurveyItem extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
  }

  static get observedAttributes() {
    return ["type", "options", "required"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    const type = this.getAttribute("type") || "checkbox";
    const options = JSON.parse(this.getAttribute("options") || "[]");
    const required = this.getAttribute("required") === "true";

    if (chatClient.lang == "da") {
      // Temporary fix for different value/labels
      options.forEach((option, index) => {
        if (option === "yes") options[index] = "ja";
        if (option === "no") options[index] = "nej";
      });
    }

    let inputElements = "";
    if (type === "slider") {
      const marks = options
        .map(
          (label, index) =>
            `<option label="${label}" value="${index}"></option>`,
        )
        .join("");
      const labels = options
        .map((label, index) => `<span>${label}</span>`)
        .join("");

      inputElements = `
        <div class="slider-container">
          <input type="range" min="0" max="${options.length - 1}" step="1" value="0" id="slider" list="tickmarks" />
          <datalist id="tickmarks">
            ${marks}
          </datalist>
          <div id="ticklabels">
            ${labels}
          </div>
        </div>
      `;
    } else {
      inputElements = options
        .map((option) => {
          let label = option;
          let value = option;
          let tip = "";

          if (typeof option === "object") {
            label = option.label;
            value = option.value || option.label;
            tip = option.tip;
          }

          return `
          <div>
            <label for="${value}" title="${tip || ""}">
              <input type="${type}" id="${value}" name="survey-option" value="${value}" />
              ${label}
              ${tip ? `<i class="fa-regular fa-circle-question"></i>` : ""}
            </label>
          </div>
        `;
        })
        .join("");
    }

    this.shadowRoot.innerHTML = `
      <font-awesome-loader></font-awesome-loader>
      <style>
        @import url("https://use.fontawesome.com/releases/v6.6.0/css/all.css");

        fieldset {
          border: 1px white solid;
          border-radius: 5px;
          padding: 5px;
          display: flex;
          flex-flow: wrap;
          ${type === "radio" ? "flex-direction: column;" : ""}
          gap: 5px;
        }

        fieldset > legend {
          margin: auto;
          font-weight: bold;
          padding: 0 8px;
          color: white;
        }

        fieldset > div {
          z-index: 1;
          position: relative;
          min-width: auto;
          max-width: 100%;
        }

        fieldset > div > label {
          user-select: none; 
          display: flex;
          padding: 8px 10px;
          color: black;
          background: white;
          border-radius: 4px;
          white-space: normal;
          line-height: 1.4;
          max-width: 100%;
          width: fit-content;
          box-sizing: border-box;
        }

        fieldset > div > label:hover:not(:has(> input:disabled)) {
          cursor: pointer;
          color: black;
          background: var(--platinum);
        }

        fieldset > div > label input {
          margin: 2px 10px 0 0;
          flex-shrink: 0;
          accent-color: var(--black);
        }

        fieldset > div > label > i {
          padding-left: 5px;
        }

        fieldset > div > label input:not(:disabled) {
          cursor: pointer;
        }

        button {
          margin-top: 10px;
          padding: 2px 10px;
          font-size: 1rem;
          font-weight: bold;
          float: right;
          background-color: white;
          border: 1px white solid;
          border-radius: 5px;
        }

        button:hover {
          cursor: pointer;
          background: var(--platinum);
        }

        .slider-container {
          width: 100%;
        }

        .slider-container input[type="range"] {
          width: 100%;
          margin: 10px 0;
          accent-color: var(--pink);
        }

        #ticklabels {
          display: flex;
          justify-content: space-between;
          gap: 30px;
        }
        
        #ticklabels > span {
          display:inline;
          flex: 1;
          text-align: center;
        }
        
        #ticklabels > span:first-child {
          text-align: left;
          flex: 0.6;
        }
        #ticklabels > span:last-child {
          text-align:right; 
          flex:0.6;
        }
        #tickmarks > option {
          display:none
        }
      </style>
      <fieldset>
        <legend>${type === "slider" ? "Pick a value" : type === "radio" ? "Choose one" : "Select multiple"}</legend>
        ${inputElements}
      </fieldset>
      <button class="send survey" onclick="this.getRootNode().host.sendAnswer()">
        <i class="fa-solid fa-arrow-right"></i>
      </button>
    `;
  }

  sendAnswer() {
    let selectedOptions = [];

    if (this.getAttribute("type") === "slider") {
      const slider = this.shadowRoot.querySelector("#slider");
      const options = JSON.parse(this.getAttribute("options") || "[]");
      selectedOptions = [options[slider.value]];
      console.log(selectedOptions);
    } else {
      selectedOptions = Array.from(
        this.shadowRoot.querySelectorAll("input:checked"),
      ).map((input) => input.value);
    }

    if (
      this.getAttribute("required") === "true" &&
      selectedOptions.length === 0
    ) {
      alert("Please select at least one option");
      return;
    }

    if (this.getAttribute("type") === "slider") {
    } else {
      this.shadowRoot
        .querySelectorAll("input:not(:checked)")
        .forEach((input) => {
          input.parentElement.parentElement.remove();
        });
    }

    this.shadowRoot.querySelectorAll("input").forEach((input) => {
      input.disabled = true;
    });

    const chatUI = chatClient.chatUI;
    if (chatUI.role === "respondent") {
      chatUI.disableInput();
      chatUI.createLoadingIndicator();
    }
    chatUI.ws.sendjson({
      type: "message",
      content: selectedOptions.join(", "),
    });

    const button = this.shadowRoot.querySelector("button");
    if (button) {
      button.remove();
    }
  }
}

customElements.define("survey-item", SurveyItem);
