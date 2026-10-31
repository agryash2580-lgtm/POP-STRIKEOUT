(() => {
  if (globalThis.Pop.guardInstalled) return;
  const Pop = globalThis.Pop;
  Pop.guardInstalled = true;
  let lastEditor = null;
  let watchlist = [];
  let enabled = true;

  Pop.editable = function (element) {
    if (!(element instanceof Element)) return null;
    const editor = element.closest('input,textarea,[contenteditable]');
    if (!editor || editor.closest('#strikeout-pop-pet')) return null;
    if (editor.matches('input') && !['text', 'email', 'tel', 'url', 'search'].includes(editor.type)) return null;
    if (editor.disabled || editor.readOnly) return null;
    if (editor.hasAttribute('contenteditable') && !editor.isContentEditable) return null;
    return editor;
  };

  Pop.editorText = editor => editor.matches('input,textarea') ? editor.value : editor.textContent;
  lastEditor = Pop.editable(document.activeElement);
  PopAPI.storage.local.get(['watchlist', 'sharingGuard']).then(settings => {
    watchlist = settings.watchlist || [];
    enabled = settings.sharingGuard !== false;
  });
  PopAPI.storage.onChanged.addListener(changes => {
    if (changes.watchlist) watchlist = changes.watchlist.newValue || [];
    if (changes.sharingGuard) enabled = changes.sharingGuard.newValue !== false;
  });

  function checkEditor(editor) {
    if (!editor?.isConnected || !Pop.noticeSharing) return;
    const text = Pop.editorText(editor);
    const matches = Pop.findMatches(text, watchlist);
    if (!matches.length) { Pop.say('No watched information found in this field. That is not a full privacy check.'); return; }
    Pop.noticeSharing(editor, matches);
  }

  document.addEventListener('focusin', event => {
    const editor = Pop.editable(event.target);
    if (editor) lastEditor = editor;
  });
  document.addEventListener('paste', event => {
    const editor = Pop.editable(event.target);
    if (!enabled || !editor || !Pop.active) return;
    // Let the browser perform the paste. Never prevent, change or collect unrelated input.
    setTimeout(() => {
      if (editor.isConnected && Pop.findMatches(Pop.editorText(editor), watchlist).length) checkEditor(editor);
    }, 0);
  });

  Pop.checkDraft = function () {
    if (!lastEditor?.isConnected) { Pop.say('Click in the field you want to check, then choose Check my draft. Password fields are ignored.'); return; }
    checkEditor(lastEditor);
  };

  Pop.removeFromEditor = function (editor) {
    if (!editor.isConnected) throw Error('That field is no longer on the page.');
    const before = Pop.editorText(editor);
    const matches = Pop.findMatches(before, watchlist);
    if (!matches.length) return;
    if (editor.matches('input,textarea')) {
      // Use the native setter so frameworks such as React receive the input event.
      const prototype = editor.matches('textarea') ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(editor, Pop.removeMatches(before, matches));
    } else {
      // Delete only matching text ranges; preserve the editor's existing formatting.
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let offset = 0;
      let node;
      while ((node = walker.nextNode())) { nodes.push({node, start: offset}); offset += node.textContent.length; }
      for (const match of [...matches].reverse()) {
        for (const part of [...nodes].reverse()) {
          const start = Math.max(0, match.start - part.start);
          const end = Math.min(part.node.length, match.end - part.start);
          if (end > start) part.node.deleteData(start, end - start);
        }
      }
    }
    editor.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'deleteContentBackward'}));
    editor.focus();
  };
})();
