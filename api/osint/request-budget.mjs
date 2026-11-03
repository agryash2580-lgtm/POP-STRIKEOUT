// One deadline spans all upstream requests (including retries) in an assessment.
export function providerBudget(options = {}) {
  const deadline = AbortSignal.timeout(options.budgetMs ?? 80000);
  const fetcher = options.fetcher || fetch;
  return { ...options, fetcher: (url, init = {}) => {
    deadline.throwIfAborted();
    return fetcher(url, { ...init, signal: init.signal ? AbortSignal.any([deadline, init.signal]) : deadline });
  } };
}
