// Framework-independent browser client. Use the same-origin /api proxy.
export function createReportingClient({
  base = "/api/reporting",
  fetcher = fetch,
} = {}) {
  let dataVersion = null;
  let needsReload = false;

  async function request(path, method = "GET", body) {
    const response = await fetcher(base + path, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 409) needsReload = true;
      const error = new Error(result.error || "The reporting request failed.");
      error.status = response.status;
      error.code = result.code;
      throw error;
    }
    if (Number.isInteger(result.dataVersion)) {
      dataVersion = result.dataVersion;
      if (method === "GET") needsReload = false;
    }
    return result;
  }

  async function change(path, method, body = {}) {
    if (needsReload) {
      const error = new Error(
        "Reload the case and review its saved version before trying another change.",
      );
      error.status = 409;
      throw error;
    }
    if (dataVersion === null) await request("/cases");
    return request(path, method, { ...body, dataVersion });
  }

  const casePath = (id) => "/cases/" + encodeURIComponent(id);
  return {
    getChannels: () => request("/channels"),
    listCases: () => request("/cases"),
    getCase: (id) => request(casePath(id)),
    createCase: (details) => change("/cases", "POST", { details }),
    updateCase: (id, details) => change(casePath(id), "PATCH", { details }),
    deleteCase: (id) => change(casePath(id), "DELETE", { confirm: true }),
    addEvidence: (id, evidence) =>
      change(casePath(id) + "/evidence", "POST", { evidence }),
    removeEvidence: (id, evidenceId) =>
      change(
        casePath(id) + "/evidence/" + encodeURIComponent(evidenceId),
        "DELETE",
      ),
    evidenceFileURL: (id, evidenceId) =>
      base +
      casePath(id) +
      "/evidence/" +
      encodeURIComponent(evidenceId) +
      "/file",
    generateDraft: (id, selection) =>
      change(casePath(id) + "/draft", "POST", selection),
    editDraft: (id, text) => change(casePath(id) + "/draft", "PATCH", { text }),
    approveDraft: (id, text) =>
      change(casePath(id) + "/draft/approve", "POST", { text, reviewed: true }),
    exportURL: (id, format = "text") =>
      base + casePath(id) + "/export?format=" + encodeURIComponent(format),
    recordSubmission: (id, record) =>
      change(casePath(id) + "/submissions", "POST", {
        ...record,
        submittedByMe: true,
      }),
    addFollowUp: (id, details) =>
      change(casePath(id) + "/follow-ups", "POST", details),
    completeFollowUp: (id, followUpId) =>
      change(
        casePath(id) + "/follow-ups/" + encodeURIComponent(followUpId),
        "PATCH",
        { status: "done" },
      ),
    reopenFollowUp: (id, followUpId) =>
      change(
        casePath(id) + "/follow-ups/" + encodeURIComponent(followUpId),
        "PATCH",
        { status: "pending" },
      ),
    recordResolution: (id, outcome) =>
      change(casePath(id) + "/resolution", "POST", outcome),
  };
}

// Call only after the user chooses a file. Upload never happens automatically.
export async function evidenceFile(file) {
  if (!["image/png", "image/jpeg", "application/pdf"].includes(file.type))
    throw Error("Choose PNG, JPEG or PDF.");
  if (file.size > 500 * 1024)
    throw Error("Keep each evidence file below 500 KB.");
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error("This file could not be read."));
    reader.readAsDataURL(file);
  });
  return { name: file.name, type: file.type, data };
}

// Prefill a form from Pop's explicit handoff. This does not save or submit it.
export function parsePopHandoff(hash) {
  if (
    typeof hash !== "string" ||
    !hash.startsWith("#handoff=") ||
    hash.length > 40000
  )
    return null;
  try {
    const value = JSON.parse(decodeURIComponent(hash.slice(9)));
    if (
      !value ||
      typeof value.description !== "string" ||
      value.description.length > 8000
    )
      return null;
    let profile = "";
    if (typeof value.link === "string" && value.link.length <= 2000) {
      const url = new URL(value.link);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        return null;
      profile = url.origin + url.pathname;
    }
    return {
      title: "Evidence from Pop",
      category: "other",
      description: value.description,
      profile,
    };
  } catch {
    return null;
  }
}
