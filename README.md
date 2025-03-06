# Nostr Feedback button

Let your users screen into the ether about bugs and broken features

## Options

The `createFeedbackButton` takes some options

```js
createFeedbackButton({
  developer: "<your nostr pubkey>",
  namespace: "<name of your application>",
  relays: [
    // a list of relays to publish the feedback events to
    "wss://relay.example.com",
  ],

  // Optional methods

  // Create an additional block of metadata that will be included at the bottom of the feedback
  getMetadataBlock: () => {
    return [`location: ${location.href}`].join("/n");
  },

  // Allows the user the option to sign the event with their current pubkey
  signEvent: (draft) => window.nostr.signEvent(draft),

  // override event publishing
  publishEvent: async (event, relays) => {
    // implement custom relay publishing logic
    await relayPool.send(event, relays);
  },

  // callback method called when feedback event is published
  onFeedback: () => {
    // recommended to show confetti
    confetti({
      particleCount: 100,
      spread: 70,
    });
  },
});
```

## Adding to html

```html
<head>
  <link rel="stylesheet" href="//unpkg.com/nostr-feedback-button/styles.css" />
  <script src="//unpkg.com/nostr-feedback-button/feedback.browser.js"></script>
  <script>
    window.nostr_feedback.createFeedbackButton({
      developer: "<your nostr pubkey>",
      namespace: "<name of your application>",
      relays: [
        // a list of relays to publish the feedback events to
        "wss://relay.example.com",
      ],

      // additional options
    });
  </script>
</head>
```

## Using in a javascript app

```js
import { createFeedbackButton } from "nostr-feedback-button";
import "nostr-feedback-button/styles.css";

// creates and adds the feedback button to the page
createFeedbackButton({
  developer: "<your nostr pubkey>",
  namespace: "<name of your application>",
  relays: [
    // a list of relays to publish the feedback events to
    "wss://relay.example.com",
  ],

  // additional options
});
```
