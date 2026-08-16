/**
 * Cross-component signal for "the unread alert count may have changed."
 *
 * Sidebar's unread badge and the Alerts page are siblings, not
 * parent/child (Sidebar is mounted once in App.jsx and never remounts as
 * the user navigates between routes - see Sidebar.jsx), so Sidebar has no
 * way to know the Alerts page marked something read/dismissed, or that
 * "Check for New Alerts" just created new ones, unless something tells it
 * to re-fetch. This is a minimal pub/sub for exactly that one signal - not
 * a general state-management layer, and deliberately not a full count
 * broadcast (Sidebar re-fetches its own authoritative count rather than
 * trusting a number computed elsewhere, so it can never drift out of sync
 * with the server).
 */

const listeners = new Set();

/** Call after any action that could change how many alerts are unread (marking read, dismissing, or monitoring for new ones). */
export const notifyAlertsChanged = () => {
  listeners.forEach((listener) => listener());
};

/** @returns {() => void} an unsubscribe function - call on unmount. */
export const subscribeToAlertsChanged = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
