(() => {
  if (globalThis.Pop.guardInstalled) return;
  const Pop = globalThis.Pop;
  Pop.guardInstalled = true;
  let lastEditor = null;
  let watchlist = [];
  let enabled = true;
  const pendingChecks = new WeakMap();
  let warnedSignatures = new WeakMap();

  Pop.editable = function (element) {
    if (!(element instanceof Element)) return null;
    const editor = element.closest("input,textarea,[contenteditable]");
    if (!editor || editor.closest("#strikeout-pop-pet")) return null;
    if (
      editor.matches("input") &&
      !["text", "email", "tel", "url", "search"].includes(editor.type)
    )
      return null;
    if (editor.disabled || editor.readOnly) return null;
    if (editor.hasAttribute("contenteditable") && !editor.isContentEditable)
      return null;
    return editor;
  };

  Pop.editorText = (editor) =>
    editor.matches("input,textarea") ? editor.value : editor.textContent;
  lastEditor = Pop.editable(document.activeElement);
  PopAPI.storage.local.get(["watchlist", "sharingGuard"]).then((settings) => {
    watchlist = settings.watchlist || [];
    enabled = settings.sharingGuard !== false;
  });
  PopAPI.storage.onChanged.addListener((changes) => {
    if (changes.watchlist) {
      watchlist = changes.watchlist.newValue || [];
      warnedSignatures = new WeakMap();
    }
    if (changes.sharingGuard) enabled = changes.sharingGuard.newValue !== false;
  });

  function scheduleCheck(editor, delay = 250) {
    if (!editor) return;
    clearTimeout(pendingChecks.get(editor));
    pendingChecks.set(editor, setTimeout(() => {
      if (!enabled || !Pop.active || !editor.isConnected) return;
      const matches = Pop.findMatches(Pop.editorText(editor), watchlist);
      if (!matches.length) {
        warnedSignatures.delete(editor);
        Pop.clearSharingWarning?.(editor);
        return;
      }
      const signature = matches.map(match => match.kind + ":" + match.text.toLowerCase()).sort().join("|");
      // Keep means keep: unrelated keystrokes must not reopen the same warning.
      if (warnedSignatures.get(editor) === signature) return;
      warnedSignatures.set(editor, signature);
      checkEditor(editor);
    }, delay));
  }

  function checkEditor(editor) {
    if (!editor?.isConnected || !Pop.noticeSharing) return;
    const text = Pop.editorText(editor);
    const matches = Pop.findMatches(text, watchlist);
    if (!matches.length) {
      Pop.say(
        "No watched information found in this field. That is not a full privacy check.",
      );
      return;
    }
    Pop.noticeSharing(editor, matches);
  }

  document.addEventListener("focusin", (event) => {
    const editor = Pop.editable(event.target);
    if (editor) lastEditor = editor;
  });
  document.addEventListener("paste", (event) => {
    const editor = Pop.editable(event.target);
    // Let the browser perform the paste. Never prevent, change or collect unrelated input.
    scheduleCheck(editor, 0);
  }, true);
  document.addEventListener("input", (event) => {
    if (event.isComposing) return;
    const immediate = ["insertFromPaste", "insertFromDrop"].includes(event.inputType);
    scheduleCheck(Pop.editable(event.target), immediate ? 0 : 250);
  }, true);
  document.addEventListener("change", event => scheduleCheck(Pop.editable(event.target), 0), true);
  document.addEventListener("compositionend", event => scheduleCheck(Pop.editable(event.target), 0), true);

  Pop.checkDraft = function () {
    if (!lastEditor?.isConnected) {
      Pop.say(
        "Click in the field you want to check, then choose Check my draft. Password fields are ignored.",
      );
      return;
    }
    checkEditor(lastEditor);
  };

  Pop.removeFromEditor = function (editor) {
    if (!editor.isConnected)
      throw Error("That field is no longer on the page.");
    const before = Pop.editorText(editor);
    const matches = Pop.findMatches(before, watchlist);
    if (!matches.length) return;
    if (editor.matches("input,textarea")) {
      // Use the native setter so frameworks such as React receive the input event.
      const prototype = editor.matches("textarea")
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(
        editor,
        Pop.removeMatches(before, matches),
      );
    } else {
      // Delete only matching text ranges; preserve the editor's existing formatting.
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let offset = 0;
      let node;
      while ((node = walker.nextNode())) {
        nodes.push({ node, start: offset });
        offset += node.textContent.length;
      }
      for (const match of [...matches].reverse()) {
        for (const part of [...nodes].reverse()) {
          const start = Math.max(0, match.start - part.start);
          const end = Math.min(part.node.length, match.end - part.start);
          if (end > start) part.node.deleteData(start, end - start);
        }
      }
    }
    editor.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "deleteContentBackward",
      }),
    );
    editor.focus();
  };
})();
