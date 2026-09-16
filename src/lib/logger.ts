export const logger = {
  info: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.log('[INFO]', ...args);
  },
  warn: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.warn('[WARN]', ...args);
  },
  error: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error('[ERROR]', ...args);
  },
};
