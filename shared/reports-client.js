// Import into any frontend. Same-origin cookies authenticate every operation.
export function createReportsClient({
  base = "/api/reports",
  fetcher = fetch,
} = {}) {
  async function request(path, method = "GET", body) {
    const response = await fetcher(base + path, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok)
      throw Object.assign(Error(result.error || "Report request failed."), {
        status: response.status,
      });
    return result;
  }
  const jobPath = (id) => "/jobs/" + encodeURIComponent(id);
  const casePath = (id) => "/cases/" + encodeURIComponent(id);
  return {
    capabilities: () => request("/capabilities"),
    emailStatus: () => request("/email"),
    requestEmailCode: (email) =>
      request("/email/verification", "POST", { email }),
    confirmEmail: (code) => request("/email/confirm", "POST", { code }),
    list: (id) => request(casePath(id)),
    createCase: (details, dataVersion, reviewedSelection) =>
      request("/cases", "POST", { details, dataVersion, ...reviewedSelection }),
    start: (id, reviewedSelection) =>
      request(casePath(id), "POST", reviewedSelection),
    offline: (id, evidenceIds = []) =>
      request(casePath(id) + "/offline", "POST", { evidenceIds }),
    status: (id) => request(jobPath(id)),
    advance: (id) => request(jobPath(id) + "/advance", "POST", {}),
    pdfURL: (id) => base + jobPath(id) + "/pdf",
    retryEmail: (id) =>
      request(jobPath(id) + "/email", "POST", { confirm: true }),
    summarise: (id) =>
      request(jobPath(id) + "/help", "POST", {
        mode: "summary",
        aiApproved: true,
      }),
    ask: (id, message) =>
      request(jobPath(id) + "/help", "POST", {
        mode: "guidance",
        message,
        aiApproved: true,
      }),
    progress: (id, stepId, done, note = "") =>
      request(jobPath(id) + "/progress", "POST", { stepId, done, note }),
    deleteReports: (id) => request(casePath(id), "DELETE", { confirm: true }),
    async finish(id, onUpdate = () => {}, signal) {
      let job = await request(jobPath(id));
      onUpdate(job);
      while (job.stage !== "ready") {
        signal?.throwIfAborted();
        if (job.busy) await new Promise((resolve) => setTimeout(resolve, 1500));
        job = job.busy
          ? await request(jobPath(id))
          : await request(jobPath(id) + "/advance", "POST", {});
        onUpdate(job);
      }
      return job;
    },
  };
}
