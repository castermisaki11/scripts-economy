export const safeAsync = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    console.warn('[async] error:', error);
    // swallow error to avoid crashing the game
  }
};
