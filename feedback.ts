import {
  finalizeEvent,
  generateSecretKey,
  type EventTemplate,
  type NostrEvent,
} from "nostr-tools/pure";

export const FEEDBACK_KIND = 1314;

export type FeedbackOptions = {
  /** Pubkey of the developer to tag */
  developer: string;
  /** namespace */
  namespace: string;
  /** the relays to publish to */
  relays: string[];

  /** Custom method to create a metadata block to append to the end of contents */
  getMetadataBlock?: () => string | Promise<string>;

  /** method that may be used to sign feedback event */
  signEvent?: (draft: EventTemplate) => Promise<NostrEvent> | NostrEvent;

  /** override publish method */
  publishEvent?: (event: NostrEvent, relays: string[]) => Promise<void> | void;

  /** called after feedback is published */
  onFeedback?: (event: NostrEvent) => void;
};

export function publishToRelay(
  relay: string,
  event: NostrEvent,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    try {
      const ws = new WebSocket(relay);
      let gotResponse = false;

      // Handle connection opening
      ws.onopen = () => {
        console.log(`Connected to ${relay}`);
        // Send message immediately after connection
        ws.send(JSON.stringify(["EVENT", event]));
      };

      // Handle incoming messages
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data.toString());

          // Check if this is the expected response
          if (Array.isArray(data) && data[0] === "OK" && data[1] === event.id) {
            resolve(data[2]);
            gotResponse = true;

            // close the connection
            ws.close();
          }
        } catch (error) {}
      };

      // Handle errors
      ws.onerror = (error) => {
        reject(`WebSocket error for ${relay}: ${error}`);
      };

      // Handle connection closing
      ws.onclose = () => {
        // If connection closes before getting expected response, reject
        if (!gotResponse) reject(`Failed to publish to ${relay}`);
      };
    } catch (error) {
      reject(`Failed to create WebSocket for ${relay}: ${error}`);
    }
  });
}

export async function publishToRelays(
  relays: string[],
  event: NostrEvent,
): Promise<PromiseSettledResult<string>[]> {
  // Create a promise for each WebSocket connection
  const publish = relays.map((relay) => publishToRelay(relay, event));

  return Promise.allSettled(publish);
}

async function buildFeedbackEvent(
  content: string,
  options: FeedbackOptions,
): Promise<EventTemplate> {
  if (options.getMetadataBlock) {
    const metadata = await options.getMetadataBlock();
    content += "\n\n" + metadata;
  }

  const oneMonth = 60 * 24 * 30;

  return {
    kind: FEEDBACK_KIND,
    content,
    tags: [
      ["p", options.developer],
      ["n", options.namespace],
      ["expiration", String(Math.round(Date.now() / 1000) + oneMonth)],
    ],
    created_at: Math.round(Date.now() / 1000),
  };
}

export function createFeedbackForm(
  options: FeedbackOptions,
  onsubmit: (feedback: NostrEvent) => void,
  oncancel?: () => void,
) {
  const form = document.createElement("form");
  form.classList.add("shout-form");

  const heading = document.createElement("h2");
  heading.textContent = "Feedback";
  heading.classList.add("header");
  form.appendChild(heading);

  const textarea = document.createElement("textarea");
  textarea.name = "content";
  textarea.required = true;
  textarea.rows = 10;
  form.appendChild(textarea);

  const footer = document.createElement("div");
  footer.classList.add("footer");
  form.appendChild(footer);

  const submit = document.createElement("button");
  submit.textContent = "Submit";
  submit.type = "submit";
  footer.appendChild(submit);

  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  cancel.type = "button";
  if (oncancel) cancel.onclick = oncancel;
  footer.appendChild(cancel);

  // only add the option to turn off anon if signEvent is set
  if (options.signEvent) {
    const checkboxContainer = document.createElement("div");
    checkboxContainer.classList.add("checkbox");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "anon";
    checkbox.id = "anon";
    checkbox.checked = true;
    checkboxContainer.appendChild(checkbox);

    const label = document.createElement("label");
    label.textContent = " Anonymous";
    label.htmlFor = "anon";
    checkboxContainer.appendChild(label);

    footer.appendChild(checkboxContainer);
  }

  form.onsubmit = async (e) => {
    e.preventDefault();

    form.classList.add("submitting");
    submit.disabled = true;

    try {
      const data = new FormData(form);
      const content = data.get("content");
      if (!content) throw new Error("Cant find content");
      const anon = data.get("anon");

      const draft = await buildFeedbackEvent(String(content), options);

      const signed =
        options.signEvent && anon !== "on"
          ? await options.signEvent(draft)
          : finalizeEvent(draft, generateSecretKey());

      if (options.publishEvent) {
        await options.publishEvent(signed, options.relays);
      } else {
        await publishToRelays(options.relays, signed);
      }

      onsubmit(signed);
    } catch (error) {}

    submit.disabled = false;
    form.classList.remove("submitting");
  };

  return form;
}

export function createFeedbackButton(options: FeedbackOptions) {
  const container = document.createElement("div");
  container.classList.add("shout-container");

  const button = document.createElement("button");
  button.classList.add("shout-button");
  button.textContent = "🗯";

  const openForm = () => {
    form.style.display = "flex";
    button.style.display = "none";
  };
  const closeForm = () => {
    form.style.display = "none";
    button.style.display = "block";
  };

  const form = createFeedbackForm(
    options,
    (feedback) => {
      closeForm();
      if (options.onFeedback) options.onFeedback(feedback);
    },
    closeForm,
  );
  form.style.display = "none";

  container.appendChild(button);
  container.appendChild(form);

  // show form when button is clicked
  button.onclick = openForm;

  // close the form when click is outside container
  document.body.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement) {
      let node = event.target;
      while (node.parentElement) {
        if (node.parentElement === container) {
          // click was inside container, exit
          return;
        } else {
          // keep walking up the tree
          node = node.parentElement;
        }
      }

      // click was outside for the form, close the form
      form.style.display = "none";
      button.style.display = "block";
    }
  });

  document.body.appendChild(container);

  return container;
}

// @ts-expect-error
window.nostr_feedback = {
  createFeedbackButton,
};
