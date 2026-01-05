class ModalForm extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  static get observedAttributes() {
    return ["title", "entity"];
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    const title = this.getAttribute("title") || "Create New Item";
    const entity = this.getAttribute("entity") || "item";
    const buttonVerb = this.getAttribute("button-verb") || "Create";
    const width = this.getAttribute("width") || "400px";
    this.shadowRoot.innerHTML = `
            <style>
                .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); display: none; justify-content: center; align-items: center; z-index: 1000; }
                .modal { background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); width: ${width}; max-width: 90%; }
                .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .close-button { border: none; background: none; font-size: 1.5rem; cursor: pointer; }
                ::slotted(.modal-form-group) { margin-bottom: 15px; }
                ::slotted(fieldset) { border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin-bottom: 15px; }
                ::slotted(fieldset.error) { border-color: red; }
                ::slotted(legend) { padding: 0 5px; }
                ::slotted(input.error), ::slotted(select.error), ::slotted(textarea.error) { border-color: red !important; }
                .submit-button { background-color: #196858; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px; align-self: end; }
                .submit-button:hover { background-color: ${buttonVerb === "Delete" ? "red" : "#1c2826"}; }
                .error-message { color: red; margin-top: 10px; display: none; }
                ::slotted(p) {margin:0 px}
            </style>
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h2>${title}</h2>
                        <button class="close-button">&times;</button>
                    </div>
                    <div id="entity-form">
                        <slot name="modal-form-group"></slot>
                        <button type="button" class="submit-button">${buttonVerb} ${entity}</button>
                        <div class="error-message"></div>
                    </div>
                </div>
            </div>
        `;
  }

  setupEventListeners() {
    const modal = this.shadowRoot.querySelector(".modal-overlay");
    const closeButton = this.shadowRoot.querySelector(".close-button");
    const submitButton = this.shadowRoot.querySelector(".submit-button");
    const errorMessage = this.shadowRoot.querySelector(".error-message");

    closeButton.addEventListener("click", () => this.close());

    modal.addEventListener("click", (e) => {
      if (e.target === modal) this.close();
    });

    submitButton.addEventListener("click", () => {
      const data = this.collectFormData();
      const validationResult = this.validateForm();

      if (validationResult.isValid) {
        this.dispatchEvent(
          new CustomEvent("modal-form-submit", {
            bubbles: true,
            composed: true,
            detail: data,
          }),
        );
        this.close();
      } else {
        errorMessage.textContent =
          validationResult.message || "Please fill all required fields";
        errorMessage.style.display = "block";
      }
    });
  }

  collectFormData() {
    const data = {};

    // Process regular form elements
    const formElements = this.querySelectorAll(
      '[slot="modal-form-group"] input:not([type="radio"]):not([type="checkbox"]), [slot="modal-form-group"] select, [slot="modal-form-group"] textarea',
    );
    formElements.forEach((element) => {
      if (element.name) {
        // Handle array inputs with names ending in []
        if (element.name.endsWith("[]")) {
          const key = element.name.slice(0, -2);
          if (!data[key]) {
            data[key] = [];
          }
          data[key].push(element.value);
        } else {
          data[element.name] = element.value;
        }
      }
    });

    // Process radio buttons
    const radioGroups = {};
    const radioButtons = this.querySelectorAll(
      '[slot="modal-form-group"] input[type="radio"]',
    );
    radioButtons.forEach((radio) => {
      if (radio.name) {
        if (!radioGroups[radio.name]) {
          radioGroups[radio.name] = [];
        }
        if (radio.checked) {
          data[radio.name] = radio.value;
        }
      }
    });

    // Process checkboxes
    const checkboxes = this.querySelectorAll(
      '[slot="modal-form-group"] input[type="checkbox"]',
    );
    checkboxes.forEach((checkbox) => {
      if (checkbox.name) {
        // For checkboxes with the same name, create an array of values
        if (checkbox.name.endsWith("[]")) {
          const key = checkbox.name.slice(0, -2);
          if (!data[key]) {
            data[key] = [];
          }
          if (checkbox.checked) {
            data[key].push(checkbox.value);
          }
        } else {
          // For single checkboxes, just store boolean or value
          data[checkbox.name] = checkbox.checked
            ? checkbox.value !== "on"
              ? checkbox.value
              : true
            : false;
        }
      }
    });

    return data;
  }

  validateForm() {
    let isValid = true;
    let message = "";

    // Clear previous error states
    this.querySelectorAll(".error").forEach((el) =>
      el.classList.remove("error"),
    );

    // Validate regular inputs, selects, and textareas
    const formElements = this.querySelectorAll(
      '[slot="modal-form-group"] input:not([type="radio"]):not([type="checkbox"]), [slot="modal-form-group"] select, [slot="modal-form-group"] textarea',
    );
    formElements.forEach((element) => {
      if (element.hasAttribute("required") && !element.value) {
        element.classList.add("error");
        isValid = false;
      } else {
        element.classList.remove("error");
      }
    });

    // Validate fieldsets with required attribute (for radio button groups)
    const fieldsets = this.querySelectorAll(
      '[slot="modal-form-group"] fieldset[required]',
    );
    fieldsets.forEach((fieldset) => {
      const radioButtons = fieldset.querySelectorAll('input[type="radio"]');
      const radioGroupName =
        radioButtons.length > 0 ? radioButtons[0].name : null;

      if (radioGroupName) {
        const anyChecked = Array.from(radioButtons).some(
          (radio) => radio.checked,
        );
        if (!anyChecked) {
          fieldset.classList.add("error");
          isValid = false;
          message = "Please select an option for all required fields";
        } else {
          fieldset.classList.remove("error");
        }
      }

      // Handle other required elements within fieldset
      const requiredElements = fieldset.querySelectorAll(
        "input[required], select[required], textarea[required]",
      );
      requiredElements.forEach((element) => {
        if (
          (element.type === "checkbox" && !element.checked) ||
          (element.type !== "checkbox" && !element.value)
        ) {
          element.classList.add("error");
          isValid = false;
        } else {
          element.classList.remove("error");
        }
      });
    });

    // handle custom validation
    if (this.id.startsWith("delete")) {
      const projectName = this.querySelector(
        "label[for$='-name'] > span",
      ).textContent;
      const inputName = this.querySelector("input[name$='-name']").value;
      if (projectName !== inputName) {
        isValid = false;
        message = "Project name does not match";
      }
    }

    return { isValid, message };
  }

  open() {
    this.shadowRoot.querySelector(".modal-overlay").style.display = "flex";
  }

  close() {
    this.shadowRoot.querySelector(".modal-overlay").style.display = "none";
    this.resetForm();
    this.shadowRoot.querySelector(".error-message").style.display = "none";
  }

  resetForm() {
    // Reset text inputs, selects, and textareas
    const formElements = this.querySelectorAll(
      '[slot="modal-form-group"] input:not([type="radio"]):not([type="checkbox"]), [slot="modal-form-group"] select, [slot="modal-form-group"] textarea',
    );
    formElements.forEach((element) => {
      element.value = "";
      element.classList.remove("error");
    });

    // Reset radio buttons
    const radioButtons = this.querySelectorAll(
      '[slot="modal-form-group"] input[type="radio"]',
    );
    radioButtons.forEach((radio) => {
      radio.checked = false;
    });

    // Reset checkboxes
    const checkboxes = this.querySelectorAll(
      '[slot="modal-form-group"] input[type="checkbox"]',
    );
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });

    // Reset fieldset error states
    const fieldsets = this.querySelectorAll(
      '[slot="modal-form-group"] fieldset',
    );
    fieldsets.forEach((fieldset) => {
      fieldset.classList.remove("error");
    });
  }
}

customElements.define("modal-form", ModalForm);
