// Shared by every exposure operation, before parsing targets or contacting providers.
export function consent(body, provider) {
  const approval = body?.consent;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !approval || typeof approval !== "object" || Array.isArray(approval) ||
      approval.selfOwned !== true || approval.version !== "1")
    throw Object.assign(Error("Confirm this is your own information or an authorized self-audit."), { status: 400 });
  if (approval.providers !== undefined &&
      (!Array.isArray(approval.providers) || approval.providers.length > 16 ||
       approval.providers.some(value => typeof value !== "string" ||
         !/^[a-z][a-z0-9_]{0,39}$/.test(value))))
    throw Object.assign(Error("Provider consent must be a list of provider names."), { status: 400 });
  if (provider && !approval.providers?.includes(provider))
    throw Object.assign(Error("Approve disclosure to " + provider + " for this request."), { status: 400 });
}
