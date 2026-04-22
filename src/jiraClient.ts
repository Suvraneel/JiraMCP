import axios, { AxiosInstance, AxiosError } from "axios";

function sanitizeLog(input: string): string {
  return String(input).replace(/[\r\n\t]/g, " ").slice(0, 200);
}

// ── In-memory cache ────────────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class SimpleCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs = 60_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, {
      data,
      expiry: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// ── Jira response types ────────────────────────────────────────────────────
export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  description: string | null;
}

export interface JiraIssueSummary {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
}

export interface JiraCommentResult {
  success: boolean;
  commentId: string;
}

export interface JiraCreateIssueResult {
  key: string;
  id: string;
  self: string;
  summary: string;
}

export interface CreateIssueParams {
  projectKey: string;
  issueType: string;
  summary: string;
  description?: string;
  assignee?: string;
  priority?: string;
  labels?: string[];
  parentKey?: string;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress: string | null;
  active: boolean;
}

export interface JiraAssignResult {
  success: boolean;
  issueKey: string;
  assignee: {
    accountId: string;
    displayName: string;
  };
}

export interface JiraTransition {
  id: string;
  name: string;
}

export interface JiraTransitionResult {
  success: boolean;
  issueKey: string;
  transitionedTo: string;
}

export interface JiraUpdateIssueResult {
  success: boolean;
  issueKey: string;
  updatedFields: string[];
}

// ── Retry / rate-limit helpers ─────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

function isRetryable(err: AxiosError): boolean {
  if (!err.response) return true; // network error
  const status = err.response.status;
  return status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── JiraClient ─────────────────────────────────────────────────────────────
export class JiraClient {
  private http: AxiosInstance;
  private cache = new SimpleCache(60_000); // 60-second TTL

  constructor(baseUrl: string, email: string | undefined, apiToken: string) {
    this.http = axios.create({
      baseURL: `${baseUrl.replace(/\/+$/, "")}/rest/api/2`,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    });
    this.updateAuth(email, apiToken);
  }

  /** Rotate credentials without restarting the server. */
  updateAuth(email: string | undefined, apiToken: string): void {
    const authorization = email
      ? `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`
      : `Bearer ${apiToken}`;
    this.http.defaults.headers.common["Authorization"] = authorization;
  }

  // ── Generic request wrapper with retry + rate-limit handling ────────────
  private async request<T>(
    method: "get" | "post" | "put",
    url: string,
    data?: unknown,
    params?: Record<string, string | number>
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        let response;
        if (method === "get") {
          response = await this.http.get<T>(url, { params });
        } else if (method === "put") {
          response = await this.http.put<T>(url, data);
        } else {
          response = await this.http.post<T>(url, data);
        }

        return response.data;
      } catch (err) {
        const axiosErr = err as AxiosError;
        lastError = axiosErr;

        if (!isRetryable(axiosErr) || attempt === MAX_RETRIES - 1) {
          break;
        }

        // Respect Retry-After header when rate-limited (429)
        let delayMs = RETRY_BASE_DELAY_MS * 2 ** attempt;
        if (axiosErr.response?.status === 429) {
          const retryAfter = axiosErr.response.headers["retry-after"];
          if (retryAfter) {
            delayMs = parseInt(retryAfter, 10) * 1_000;
          }
          console.error(
            `[JiraClient] Rate limited. Retrying in ${delayMs}ms…`
          );
        } else {
          console.error(
            `[JiraClient] Request failed (attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${delayMs}ms…`
          );
        }

        await sleep(delayMs);
      }
    }

    // Format a helpful error message
    const axiosErr = lastError as AxiosError;
    if (axiosErr?.response) {
      const status = axiosErr.response.status;
      const body =
        typeof axiosErr.response.data === "string"
          ? axiosErr.response.data
          : JSON.stringify(axiosErr.response.data);
      console.error(`[JiraClient] API error ${status}: ${sanitizeLog(body)}`);
      throw new Error(`Jira API error (HTTP ${status})`);
    }
    throw new Error(
      `Jira API request failed: ${lastError?.message ?? "unknown error"}`
    );
  }

  private extractDescription(desc: any): string {
    if (!desc) return "";
    if (typeof desc === "string") return desc;
    // ADF fallback
    if (desc.type === "doc" && Array.isArray(desc.content)) {
      return desc.content.map((n: any) => this.extractDescription(n)).join("");
    }
    if (desc.type === "text") return desc.text ?? "";
    if (Array.isArray(desc.content)) {
      return desc.content.map((n: any) => this.extractDescription(n)).join("");
    }
    return "";
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Fetch a single Jira issue by key (e.g. "PROJ-123"). */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    const cacheKey = `issue:${issueKey}`;
    const cached = this.cache.get<JiraIssue>(cacheKey);
    if (cached) {
      console.error(`[JiraClient] Cache hit for ${sanitizeLog(cacheKey)}`);
      return cached;
    }

    console.error(`[JiraClient] Fetching issue ${sanitizeLog(issueKey)}`);
    const raw = await this.request<any>(
      "get",
      `/issue/${encodeURIComponent(issueKey)}?fields=summary,status,assignee,description`
    );

    const issue: JiraIssue = {
      key: raw.key,
      summary: raw.fields?.summary ?? "",
      status: raw.fields?.status?.name ?? "Unknown",
      assignee: raw.fields?.assignee?.displayName ?? null,
      description: this.extractDescription(raw.fields?.description) || null,
    };

    this.cache.set(cacheKey, issue);
    return issue;
  }

  /** Search issues using JQL. Returns a lightweight summary array. */
  async searchIssues(jql: string): Promise<JiraIssueSummary[]> {
    const cacheKey = `search:${jql}`;
    const cached = this.cache.get<JiraIssueSummary[]>(cacheKey);
    if (cached) {
      console.error(`[JiraClient] Cache hit for search`);
      return cached;
    }

    console.error(`[JiraClient] Searching issues with JQL: ${sanitizeLog(jql)}`);
    const raw = await this.request<any>("get", "/search", undefined, {
      jql,
      maxResults: 50,
      fields: "summary,status,assignee",
    });

    const issues: JiraIssueSummary[] = (raw.issues ?? []).map((i: any) => ({
      key: i.key,
      summary: i.fields?.summary ?? "",
      status: i.fields?.status?.name ?? "Unknown",
      assignee: i.fields?.assignee?.displayName ?? null,
    }));

    this.cache.set(cacheKey, issues);
    return issues;
  }

  /** Add a comment to a Jira issue. */
  async addComment(
    issueKey: string,
    comment: string
  ): Promise<JiraCommentResult> {
    console.error(`[JiraClient] Adding comment to ${sanitizeLog(issueKey)}`);

    const body = { body: comment };

    const raw = await this.request<any>(
      "post",
      `/issue/${encodeURIComponent(issueKey)}/comment`,
      body
    );

    // Invalidate cached issue so next fetch reflects the new comment
    this.cache.invalidate(`issue:${issueKey}`);

    return { success: true, commentId: raw.id };
  }

  /** Create a new Jira issue (Story, Task, Bug, Epic, Sub-task, etc.). */
  async createIssue(params: CreateIssueParams): Promise<JiraCreateIssueResult> {
    console.error(
      `[JiraClient] Creating ${sanitizeLog(params.issueType)} in project ${sanitizeLog(params.projectKey)}: "${sanitizeLog(params.summary)}"`
    );

    // Build the fields payload
    const fields: Record<string, unknown> = {
      project: { key: params.projectKey },
      issuetype: { name: params.issueType },
      summary: params.summary,
    };

    if (params.description) {
      fields.description = params.description;
    }

    // Optional assignee (requires Atlassian account ID)
    if (params.assignee) {
      fields.assignee = { accountId: params.assignee };
    }

    // Optional priority
    if (params.priority) {
      fields.priority = { name: params.priority };
    }

    // Optional labels
    if (params.labels && params.labels.length > 0) {
      fields.labels = params.labels;
    }

    // Optional parent (for sub-tasks or child issues)
    if (params.parentKey) {
      fields.parent = { key: params.parentKey };
    }

    const raw = await this.request<any>("post", "/issue", { fields });

    // Invalidate search cache since a new issue was created
    this.cache.clear();

    return {
      key: raw.key,
      id: raw.id,
      self: raw.self,
      summary: params.summary,
    };
  }

  /** Search for Jira users by display name or email. Returns matching users with account IDs. */
  async searchUsers(query: string): Promise<JiraUser[]> {
    const cacheKey = `users:${query}`;
    const cached = this.cache.get<JiraUser[]>(cacheKey);
    if (cached) {
      console.error(`[JiraClient] Cache hit for user search: ${sanitizeLog(query)}`);
      return cached;
    }

    console.error(`[JiraClient] Searching users with query: ${sanitizeLog(query)}`);
    const raw = await this.request<any[]>("get", "/user/search", undefined, {
      query,
      maxResults: 10,
    });

    const users: JiraUser[] = (raw ?? []).map((u: any) => ({
      accountId: u.accountId,
      displayName: u.displayName ?? "",
      emailAddress: u.emailAddress ?? null,
      active: u.active ?? false,
    }));

    this.cache.set(cacheKey, users);
    return users;
  }

  /** Assign a Jira issue to a user by account ID. Pass null to unassign. */
  async assignIssue(
    issueKey: string,
    accountId: string | null
  ): Promise<JiraAssignResult> {
    console.error(
      `[JiraClient] Assigning ${sanitizeLog(issueKey)} to ${sanitizeLog(accountId ?? "unassigned")}`
    );

    // PUT /rest/api/3/issue/{issueKey}/assignee
    await this.request<void>(
      "put",
      `/issue/${encodeURIComponent(issueKey)}/assignee`,
      { accountId }
    );

    // Invalidate cached issue so next fetch reflects the new assignee
    this.cache.invalidate(`issue:${issueKey}`);
    this.cache.clear(); // also clear search caches

    // If assigning (not unassigning), fetch user display name for the response
    let displayName = "Unassigned";
    if (accountId) {
      try {
        const users = await this.searchUsers(accountId);
        const match = users.find((u) => u.accountId === accountId);
        displayName = match?.displayName ?? accountId;
      } catch {
        // Fallback: just return the account ID
        displayName = accountId;
      }
    }

    return {
      success: true,
      issueKey,
      assignee: {
        accountId: accountId ?? "none",
        displayName,
      },
    };
  }

  /** Get available transitions for an issue. */
  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    console.error(`[JiraClient] Fetching transitions for ${sanitizeLog(issueKey)}`);
    const raw = await this.request<any>(
      "get",
      `/issue/${encodeURIComponent(issueKey)}/transitions`
    );

    return (raw.transitions ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
    }));
  }

  /** Update a Jira issue's summary and/or description. */
  async updateIssue(
    issueKey: string,
    updates: { summary?: string; description?: string }
  ): Promise<JiraUpdateIssueResult> {
    console.error(`[JiraClient] Updating ${sanitizeLog(issueKey)}`);

    const fields: Record<string, unknown> = {};
    if (updates.summary) fields.summary = updates.summary;
    if (updates.description) fields.description = updates.description;

    await this.request<void>(
      "put",
      `/issue/${encodeURIComponent(issueKey)}`,
      { fields }
    );

    this.cache.invalidate(`issue:${issueKey}`);
    this.cache.clear();

    return {
      success: true,
      issueKey,
      updatedFields: Object.keys(fields),
    };
  }

  /** Transition a Jira issue to a new status by status name (e.g. "Done", "In Progress"). */
  async transitionIssue(
    issueKey: string,
    statusName: string
  ): Promise<JiraTransitionResult> {
    console.error(
      `[JiraClient] Transitioning ${sanitizeLog(issueKey)} to "${sanitizeLog(statusName)}"`
    );

    // First, fetch available transitions to find the matching ID
    const transitions = await this.getTransitions(issueKey);
    const match = transitions.find(
      (t) => t.name.toLowerCase() === statusName.toLowerCase()
    );

    if (!match) {
      const available = transitions.map((t) => t.name).join(", ");
      throw new Error(
        `No transition to "${statusName}" found for ${issueKey}. Available transitions: ${available}`
      );
    }

    // POST the transition
    await this.request<void>(
      "post",
      `/issue/${encodeURIComponent(issueKey)}/transitions`,
      { transition: { id: match.id } }
    );

    // Invalidate caches
    this.cache.invalidate(`issue:${issueKey}`);
    this.cache.clear();

    return {
      success: true,
      issueKey,
      transitionedTo: match.name,
    };
  }
}

