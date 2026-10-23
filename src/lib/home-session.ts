// Browser module state survives client navigation, and resets on a full page load.
// It is only changed from effects/frame callbacks, never during server rendering.
export const homeSession = { loaded: false };
