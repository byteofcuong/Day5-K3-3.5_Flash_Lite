/**
 * Minimal observable store. Views subscribe to the slices they render, so a
 * state change updates exactly the parts of the UI that depend on it.
 */
export function createStore(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();

  const notify = (previous) => listeners.forEach((listener) => listener(state, previous));

  return {
    get() {
      return state;
    },

    set(patch) {
      const previous = state;
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      notify(previous);
      return state;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Subscribes to one derived value and only fires when it actually changes.
     * @param {(state: object) => any} selector
     */
    select(selector, listener) {
      let current = selector(state);
      return this.subscribe((next) => {
        const value = selector(next);
        if (value !== current) {
          const previous = current;
          current = value;
          listener(value, previous);
        }
      });
    },
  };
}
