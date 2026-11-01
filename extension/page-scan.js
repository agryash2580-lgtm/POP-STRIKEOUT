(() => {
  const Pop = globalThis.Pop;
  let highlights = [];
  let current = -1;

  Pop.clearHighlights = function () {
    for (const mark of highlights) {
      if (mark.isConnected)
        mark.replaceWith(document.createTextNode(mark.textContent));
    }
    highlights = [];
    current = -1;
  };

  Pop.scanPage = function (watchlist) {
    Pop.clearHighlights();
    if (!document.body) return { count: 0, limited: false };
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const found = [];
    let characters = 0;
    let visited = 0;
    let limited = false;
    let node;
    while ((node = walker.nextNode())) {
      if (++visited > 10000 || characters > 300000 || found.length >= 100) {
        limited = true;
        break;
      }
      const parent = node.parentElement;
      if (
        !parent ||
        parent.closest(
          "script,style,noscript,textarea,input,select,[contenteditable],#strikeout-pop-pet",
        )
      )
        continue;
      if (!parent.getClientRects().length) continue;
      const style = getComputedStyle(parent);
      if (
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        style.opacity === "0"
      )
        continue;
      characters += node.textContent.length;
      const matches = Pop.findMatches(node.textContent, watchlist);
      if (matches.length) found.push({ node, matches });
    }
    // Collect first, then edit the DOM: modifying it while walking skips nodes.
    for (const entry of found) {
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      for (const match of entry.matches) {
        if (highlights.length >= 100) {
          limited = true;
          break;
        }
        fragment.append(
          document.createTextNode(
            entry.node.textContent.slice(cursor, match.start),
          ),
        );
        const mark = document.createElement("mark");
        mark.textContent = match.text;
        mark.title = "Pop found a watched " + match.kind + " on this page.";
        mark.style.cssText =
          "background:#ffe384!important;color:#28153f!important;outline:2px solid #7540b3!important;scroll-margin:100px;";
        mark.dataset.popMatch = "true";
        fragment.append(mark);
        highlights.push(mark);
        cursor = match.end;
      }
      fragment.append(
        document.createTextNode(entry.node.textContent.slice(cursor)),
      );
      entry.node.replaceWith(fragment);
    }
    return { count: highlights.length, limited };
  };

  Pop.nextHighlight = function (direction = 1) {
    highlights = highlights.filter((mark) => mark.isConnected);
    if (!highlights.length)
      return "No remaining matches. Run Check this page again.";
    current = (current + direction + highlights.length) % highlights.length;
    highlights[current].scrollIntoView({
      block: "center",
      behavior: "instant",
    });
    return (
      "Match " +
      (current + 1) +
      " of " +
      highlights.length +
      ": " +
      highlights[current].textContent
    );
  };
})();
