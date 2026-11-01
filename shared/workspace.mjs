// Three-way merge: changed fields are compared with the version the tab loaded.
export const workspace = (value) => ({
  cases: value?.cases || [],
  identifiers: value?.identifiers || [],
});
export function equal(a, b) {
  if (a === b) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  )
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ak = Object.keys(a),
    bk = Object.keys(b);
  return (
    ak.length === bk.length &&
    ak.every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]))
  );
}
export function mergeWorkspace(base, local, remote) {
  const conflicts = [];
  function merge(before, mine, theirs, path, segments = []) {
    if (equal(mine, before)) return theirs;
    if (equal(theirs, before) || equal(mine, theirs)) return mine;
    if (
      Array.isArray(mine) &&
      Array.isArray(theirs) &&
      Array.isArray(before) &&
      [...mine, ...theirs, ...before].every(
        (x) => x && typeof x.id === "string",
      )
    ) {
      const previous = new Map(before.map((x) => [x.id, x])),
        left = new Map(mine.map((x) => [x.id, x])),
        right = new Map(theirs.map((x) => [x.id, x]));
      const ids = [
          ...new Set([...mine, ...theirs, ...before].map((x) => x.id)),
        ],
        out = [];
      for (const id of ids) {
        const value = merge(
          previous.get(id),
          left.get(id),
          right.get(id),
          path + "[" + id + "]",
          [...segments, { id }],
        );
        if (value !== undefined) out.push(value);
      }
      if (path.endsWith(".timeline"))
        out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
      return out;
    }
    if (
      before &&
      mine &&
      theirs &&
      ![before, mine, theirs].some(Array.isArray) &&
      [before, mine, theirs].every((x) => typeof x === "object")
    ) {
      const out = {};
      for (const key of new Set([
        ...Object.keys(before),
        ...Object.keys(mine),
        ...Object.keys(theirs),
      ])) {
        const value =
          key === "updatedAt"
            ? [mine[key], theirs[key]].filter(Boolean).sort().at(-1)
            : merge(
                before[key],
                mine[key],
                theirs[key],
                path ? path + "." + key : key,
                [...segments, key],
              );
        if (value !== undefined) out[key] = value;
      }
      return out;
    }
    conflicts.push({ path, segments, local: mine, remote: theirs });
    return mine;
  }
  return {
    merged: merge(workspace(base), workspace(local), workspace(remote), ""),
    conflicts,
  };
}
export function resolveWorkspaceConflicts(value, conflicts, side) {
  const out = structuredClone(workspace(value));
  for (const conflict of conflicts) {
    let node = out;
    const steps = conflict.segments;
    for (let i = 0; i < steps.length - 1; i++) {
      const step = steps[i];
      node =
        typeof step === "object"
          ? node?.find((x) => x.id === step.id)
          : node?.[step];
      if (!node) break;
    }
    if (!node) continue;
    const last = steps.at(-1),
      selected = conflict[side];
    if (typeof last === "object") {
      const index = node.findIndex((x) => x.id === last.id);
      if (selected === undefined) {
        if (index >= 0) node.splice(index, 1);
      } else if (index >= 0) node[index] = structuredClone(selected);
      else node.push(structuredClone(selected));
    } else if (selected === undefined) delete node[last];
    else
      Object.defineProperty(node, last, {
        value: structuredClone(selected),
        enumerable: true,
        writable: true,
        configurable: true,
      });
  }
  return out;
}
