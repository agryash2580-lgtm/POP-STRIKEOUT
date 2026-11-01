// IndexedDB holds screenshots without filling the much smaller settings store.
globalThis.PopEvidence = (() => {
  let database;
  async function open() {
    if (database) return database;
    database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("pop-evidence", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("records", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return database;
  }

  async function transaction(mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("records", mode);
      const request = operation(tx.objectStore("records"));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () =>
        reject(
          tx.error ||
            Error(
              "Evidence could not be saved. Try exporting older records to free space.",
            ),
        );
      tx.onerror = () => reject(tx.error);
    });
  }

  async function download(name, blob) {
    const url = URL.createObjectURL(blob);
    try {
      return await PopAPI.downloads.download({
        url,
        filename: name,
        conflictAction: "uniquify",
        saveAs: false,
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  }

  function escapeHTML(text) {
    return String(text).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  async function exportIncident(records) {
    if (!records.length) return;
    const parts = [];
    for (const record of records) {
      const image = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(record.image);
      });
      parts.push(
        "<article><h2>" +
          escapeHTML(record.title || "Captured page") +
          "</h2><p>Address: " +
          escapeHTML(record.address) +
          "</p><p>Captured (device clock): " +
          escapeHTML(record.capturedAt) +
          "</p><pre>" +
          escapeHTML(record.selectedText + "\n\nNote: " + record.note) +
          '</pre><img alt="Reviewed screenshot" src="' +
          image +
          '"></article>',
      );
    }
    const html =
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pop evidence export</title><style>body{font:16px/1.5 system-ui;max-width:1000px;margin:30px auto;padding:20px;color:#321c49}article{border-top:2px solid #ddd;padding:20px 0}img{max-width:100%}pre,p{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>' +
      escapeHTML(records[0].incident) +
      "</h1><p>Locally captured, user-reviewed evidence. Capture time uses the device clock. Screenshots do not establish authenticity or authorship. Redactions are baked into the included images.</p>" +
      parts.join("") +
      "</html>";
    return download(
      "pop-incident-" + records[0].id.slice(0, 8) + ".html",
      new Blob([html], { type: "text/html;charset=utf-8" }),
    );
  }

  return {
    all: () => transaction("readonly", (store) => store.getAll()),
    save: (record) => transaction("readwrite", (store) => store.put(record)),
    remove: (id) => transaction("readwrite", (store) => store.delete(id)),
    clear: () => transaction("readwrite", (store) => store.clear()),
    download,
    exportIncident,
  };
})();
