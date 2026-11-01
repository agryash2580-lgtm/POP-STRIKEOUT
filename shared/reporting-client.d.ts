export type IncidentCategory =
  | "account_takeover"
  | "impersonation"
  | "financial_fraud"
  | "harassment"
  | "exposure"
  | "other";
export type ChannelId =
  | "national_portal"
  | "instagram_recovery"
  | "facebook_recovery"
  | "google_recovery";
export interface IncidentDetails {
  title: string;
  category: IncidentCategory;
  description: string;
  platform?: string;
  occurredOn?: string;
  profile?: string;
  realProfile?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  amount?: string;
  currency?: string;
  transactionReference?: string;
  paymentProvider?: string;
  requestedOutcome?: string;
}
export interface EvidenceFile {
  name: string;
  type: "image/png" | "image/jpeg" | "application/pdf";
  data: string;
  size?: number;
  sha256?: string;
}
export interface EvidenceInput {
  note: string;
  url?: string;
  capturedOn?: string;
  file?: EvidenceFile;
}
export interface EvidenceRecord extends EvidenceInput {
  id: string;
  addedAt: string;
}
export interface ComplaintDraft {
  id: string;
  text: string;
  targetId: ChannelId;
  evidenceIds: string[];
  includeContact: boolean;
  generatedAt: string;
  sourceFingerprint: string;
  approvedDigest: string | null;
  approvedAt: string | null;
}
export interface SubmissionInput {
  channelId: ChannelId;
  reference?: string;
  submittedOn?: string;
  note?: string;
}
export interface Submission extends SubmissionInput {
  id: string;
  source: "user-recorded";
  officialStatus: "not_checked";
  recordedAt: string;
}
export interface FollowUp {
  id: string;
  dueOn: string;
  note: string;
  status: "pending" | "done";
  overdue: boolean;
  createdAt: string;
  completedAt?: string | null;
}
export interface Resolution {
  resolved: boolean;
  note: string;
  source: "user-reported";
  recordedAt: string;
}
export interface IncidentRecord extends IncidentDetails {
  id: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  evidence: EvidenceRecord[];
  timeline: { id: string; at: string; text: string }[];
  reporting: {
    draft: ComplaintDraft | null;
    draftStatus: "missing" | "review_required" | "approved" | "stale";
    submissions: Submission[];
    followUps: FollowUp[];
    resolution: Resolution | null;
  };
}
export interface CaseResponse {
  case: IncidentRecord;
  dataVersion: number;
}
export interface ReportSelection {
  targetId: ChannelId;
  evidenceIds: string[];
  includeContact: boolean;
}
export interface ReportingChannel {
  id: ChannelId;
  name: string;
  url: string;
  purpose: string;
  source: string;
  checkedOn: string;
  sourceStatus:
    "official_source_reviewed" | "official_endpoint_content_access_limited";
}
export interface ReportingClient {
  getChannels(): Promise<{
    categories: IncidentCategory[];
    channels: ReportingChannel[];
    guidance: Record<string, { text: string; source: string }>;
    automaticSubmission: false;
    automaticStatusTracking: false;
  }>;
  listCases(): Promise<{ cases: IncidentRecord[]; dataVersion: number }>;
  getCase(id: string): Promise<CaseResponse>;
  createCase(details: IncidentDetails): Promise<CaseResponse>;
  updateCase(
    id: string,
    details: Partial<IncidentDetails>,
  ): Promise<CaseResponse>;
  deleteCase(id: string): Promise<{ case: null; dataVersion: number }>;
  addEvidence(id: string, evidence: EvidenceInput): Promise<CaseResponse>;
  removeEvidence(id: string, evidenceId: string): Promise<CaseResponse>;
  evidenceFileURL(id: string, evidenceId: string): string;
  generateDraft(id: string, selection: ReportSelection): Promise<CaseResponse>;
  editDraft(id: string, text: string): Promise<CaseResponse>;
  approveDraft(id: string, exactText: string): Promise<CaseResponse>;
  exportURL(id: string, format?: "text" | "html"): string;
  recordSubmission(id: string, record: SubmissionInput): Promise<CaseResponse>;
  addFollowUp(
    id: string,
    followUp: { dueOn: string; note: string },
  ): Promise<CaseResponse>;
  completeFollowUp(id: string, followUpId: string): Promise<CaseResponse>;
  reopenFollowUp(id: string, followUpId: string): Promise<CaseResponse>;
  recordResolution(
    id: string,
    outcome: { resolved: boolean; note: string },
  ): Promise<CaseResponse>;
}
export function createReportingClient(options?: {
  base?: string;
  fetcher?: typeof fetch;
}): ReportingClient;
export function evidenceFile(file: File): Promise<EvidenceFile>;
export function parsePopHandoff(hash: string): IncidentDetails | null;
