// Retry helpers (Phase 1 stub)

export function shouldRetryOperation(error, attempt = 1, maxAttempts = 3) {
  if (attempt >= maxAttempts) return false;
  const retryable = [
    'network-request-failed',
    'temporarily-unavailable',
    'deadline-exceeded',
    'unavailable',
  ];
  const code = (error && (error.code || error.message)) || '';
  return retryable.some((c) => code.includes(c));
}

export async function withRetry(operation, maxAttempts = 3, delayMs = 1000) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (e) {
      lastError = e;
      if (!shouldRetryOperation(e, attempt, maxAttempts)) throw e;
      const backoff = delayMs * Math.pow(2, attempt - 1);
      // Match existing logging style in dataUtils
      try {
        console.warn(`Retrying operation (attempt ${attempt + 1}/${maxAttempts}) after ${backoff}ms delay`);
      } catch (_) {}
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastError;
}

export default { withRetry, shouldRetryOperation };
