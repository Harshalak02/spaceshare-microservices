function handleEvent(event) {
  // Mock notification sender.
  console.log(`[Notification] Event received: ${event.type}`);
}

module.exports = { handleEvent };
