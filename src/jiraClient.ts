import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";

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

export interface JiraEditCommentResult {
  success: boolean;
  commentId: string;
}

export interface JiraComment {
  id: string;
  author: string;
  body: string;
  created: string;
  updated: string;
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

export interface JiraChangelogEntry {
  id: string;
  author: string;
  created: string;
  items: Array<{
    field: string;
    fromString: string | null;
    toString: string | null;
  }>;
}

export interface JiraLinkType {
  id: string;
  name: string;
  inward: string;
  outward: string;
}

export interface JiraLinkIssueResult {
  success: boolean;
  linkType: string;
  inwardIssue: string;
  outwardIssue: string;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
  projectKey: string | null;
}

export interface JiraSprintIssue {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  type: string;
}

// ── Retry / rate-limit helpers ─────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

function isRetryable(err: AxiosError): boolean {
  if (!err.response) return true;
  const status = err.response.status;
  return status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── JiraClient ─────────────────────────────────────────────────────────────
export class JiraClient {
  private http: AxiosInstance;      // REST API v2  (write ops + most reads)
  private v3Http: AxiosInstance;    // REST API v3  (search/jql — v2 endpoint removed)
  private agileHttp: AxiosInstance; // Agile API 1.0 (boards, sprints)
  private cache = new SimpleCache(60_000);

  constructor(baseUrl: string, email: string | undefined, apiToken: string) {
    const baseRoot = baseUrl.replace(/\/+$/, "");
    const sharedHeaders = { Accept: "application/json", "Content-Type": "application/json" };
    this.http = axios.create({
      baseURL: `${baseRoot}/rest/api/2`,
      headers: sharedHeaders,
      timeout: 30_000,
    });
    this.v3Http = axios.create({
      baseURL: `${baseRoot}/rest/api/3`,
      headers: sharedHeaders,
      timeout: 30_000,
    });
    this.agileHttp = axios.create({
      baseURL: `${baseRoot}/rest/agile/1.0`,
      headers: sharedHeaders,
      timeout: 30_000,
    });
    this.updateAuth(email, apiToken);
  }

  updateAuth(email: string | undefined, apiToken: string): void {
    const authorization = email
      ? `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`
      : `Bearer ${apiToken}`;
    this.http.defaults.headers.common["Authorization"] = authorization;
    this.v3Http.defaults.headers.common["Authorization"] = authorization;
    this.agileHttp.defaults.headers.common["Authorization"] = authorization;
  }

  private async requestWith<T>(
    httpClient: AxiosInstance,
    method: "get" | "post" | "put" | "delete",
    url: string,
    data?: unknown,
    params?: Record<string, string | number>
  ): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const config: AxiosRequestConfig = { params };
        let response;
        if (method === "get") {
          response = await httpClient.get<T>(url, config);
        } else if (method === "put") {
          response = await httpClient.put<T>(url, data);
        } else if (method === "delete") {
          response = await httpClient.delete<T>(url);
        } else {
          response = await httpClient.post<T>(url, data);
        }
        return response.data;
      } catch (err) {
        const axiosErr = err as AxiosError;
        lastError = axiosErr;
        if (!isRetryable(axiosErr) || attempt === MAX_RETRIES - 1) break;
        let delayMs = RETRY_BASE_DELAY_MS * 2 ** attempt;
        if (axiosErr.response?.status === 429) {
          const retryAfter = axiosErr.response.headers["retry-after"];
          if (retryAfter) delayMs = parseInt(retryAfter, 10) * 1_000;
          console.error(`[JiraClient] Rate limited. Retrying in ${delayMs}ms...`);
        } else {
          console.error(
            `[JiraClient] Request failed (attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${delayMs}ms...`
          );
        }
        await sleep(delayMs);
      }
    }
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
    throw new Error(`Jira API request failed: ${lastError?.message ?? "unknown error"}`);
  }

  private request<T>(
    method: "get" | "post" | "put" | "delete",
    url: string,
    data?: unknown,
    params?: Record<string, string | number>
  ): Promise<T> {
    return this.requestWith<T>(this.http, method, url, data, params);
  }

  private v3Request<T>(
    method: "get" | "post" | "put" | "delete",
    url: string,
    data?: unknown,
    params?: Record<string, string | number>
  ): Promise<T> {
    return this.requestWith<T>(this.v3Http, method, url, data, params);
  }

  private agileRequest<T>(
    method: "get" | "post" | "put" | "delete",
    url: string,
    data?: unknown,
    params?: Record<string, string | number>
  ): Promise<T> {
    return this.requestWith<T>(this.agileHttp, method, url, data, params);
  }

  private extractDescription(desc: any): string {
    if (!desc) return "";
    if (typeof desc === "string") return desc;
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

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const cacheKey = `issue:${issueKey}`;
    const cached = this.cache.get<JiraIssue>(cacheKey);
    if (cached) { console.error(`[JiraClient] Cache hit for ${sanitizeLog(cacheKey)}`); return cached; }
    console.error(`[JiraClient] Fetching issue ${sanitizeLog(issueKey)}`);
    const raw = await this.request<any>("get", `/issue/${encodeURIComponent(issueKey)}?fields=summary,status,assignee,description`);
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

  async searchIssues(jql: string): Promise<JiraIssueSummary[]> {
    const cacheKey = `search:${jql}`;
    const cached = this.cache.get<JiraIssueSummary[]>(cacheKey);
    if (cached) { console.error("[JiraClient] Cache hit for search"); return cached; }
    console.error(`[JiraClient] Searching issues with JQL: ${sanitizeLog(jql)}`);
    // NOTE: GET /rest/api/2/search was removed (HTTP 410). Use v3 search/jql instead.
    const raw = await this.v3Request<any>("get", "/search/jql", undefined, {
      jql,
      maxResults: 50,
      fields: "summary,status,assignee,issuetype",
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

  async addComment(issueKey: string, comment: string): Promise<JiraCommentResult> {
    console.error(`[JiraClient] Adding comment to ${sanitizeLog(issueKey)}`);
    const raw = await this.request<any>("post", `/issue/${encodeURIComponent(issueKey)}/comment`, { body: comment });
    this.cache.invalidate(`issue:${issueKey}`);
    this.cache.invalidate(`comments:${issueKey}`);
    return { success: true, commentId: raw.id };
  }

  async editComment(issueKey: string, commentId: string, comment: string): Promise<JiraEditCommentResult> {
    console.error(`[JiraClient] Editing comment ${sanitizeLog(commentId)} on ${sanitizeLog(issueKey)}`);
    await this.request<any>("put", `/issue/${encodeURIComponent(issueKey)}/comment/${encodeURIComponent(commentId)}`, { body: comment });
    this.cache.invalidate(`issue:${issueKey}`);
    this.cache.invalidate(`comments:${issueKey}`);
    return { success: true, commentId };
  }

  async getComments(issueKey: string): Promise<JiraComment[]> {
    const cacheKey = `comments:${issueKey}`;
    const cached = this.cache.get<JiraComment[]>(cacheKey);
    if (cached) { console.error(`[JiraClient] Cache hit for ${sanitizeLog(cacheKey)}`); return cached; }
    console.error(`[JiraClient] Fetching comments for ${sanitizeLog(issueKey)}`);
    const raw = await this.request<any>("get", `/issue/${encodeURIComponent(issueKey)}/comment`);
    const comments: JiraComment[] = (raw.comments ?? []).map((c: any) => ({
      id: c.id,
      author: c.author?.displayName ?? "Unknown",
      body: this.extractDescription(c.body) || "",
      created: c.created ?? "",
      updated: c.updated ?? "",
    }));
    this.cache.set(cacheKey, comments);
    return comments;
  }

  async getIssueChangelog(issueKey: string): Promise<JiraChangelogEntry[]> {
    const cacheKey = `changelog:${issueKey}`;
    const cached = this.cache.get<JiraChangelogEntry[]>(cacheKey);
    if (cached) { console.error(`[JiraClient] Cache hit for ${sanitizeLog(cacheKey)}`); return cached; }
    console.error(`[JiraClient] Fetching changelog for ${sanitizeLog(issueKey)}`);
    const raw = await this.request<any>("get", `/issue/${encodeURIComponent(issueKey)}/changelog`);
    const entries: JiraChangelogEntry[] = (raw.values ?? raw.histories ?? []).map((h: any) => ({
      id: h.id,
      author: h.author?.displayName ?? "Unknown",
      created: h.created ?? "",
      items: (h.items ?? []).map((item: any) => ({
        field: item.field,
        fromString: item.fromString ?? null,
        toString: item.toString ?? null,
      })),
    }));
    this.cache.set(cacheKey, entries);
    return entries;
  }

  async getLinkTypes(): Promise<JiraLinkType[]> {
    const cacheKey = "linkTypes";
    const cached = this.cache.get<JiraLinkType[]>(cacheKey);
    if (cached) { console.error("[JiraClient] Cache hit for linkTypes"); return cached; }
    console.error("[JiraClient] Fetching link types");
    const raw = await this.request<any>("get", "/issueLinkType");
    const types: JiraLinkType[] = (raw.issueLinkTypes ?? []).map((t: any) => ({
      id: t.id, name: t.name, inward: t.inward, outward: t.outward,
    }));
    this.cache.set(cacheKey, types, 300_000);
    return types;
  }

  async linkIssues(outwardIssueKey: string, inwardIssueKey: string, linkTypeName: string): Promise<JiraLinkIssueResult> {
    console.error(`[JiraClient] Linking ${sanitizeLog(outwardIssueKey)} to ${sanitizeLog(inwardIssueKey)} as "${sanitizeLog(linkTypeName)}"`);
    await this.request<void>("post", "/issueLink", {
      type: { name: linkTypeName },
      outwardIssue: { key: outwardIssueKey },
      inwardIssue: { key: inwardIssueKey },
    });
    return { success: true, linkType: linkTypeName, inwardIssue: inwardIssueKey, outwardIssue: outwardIssueKey };
  }

  async getBoards(projectKey?: string): Promise<JiraBoard[]> {
    const cacheKey = `boards:${projectKey ?? "all"}`;
    const cached = this.cache.get<JiraBoard[]>(cacheKey);
    if (cached) { console.error(`[JiraClient] Cache hit for ${sanitizeLog(cacheKey)}`); return cached; }
    console.error(`[JiraClient] Fetching boards${projectKey ? ` for project ${sanitizeLog(projectKey)}` : ""}`);
    const params: Record<string, string | number> = { maxResults: 50 };
    if (projectKey) params["projectKeyOrId"] = projectKey;
    const raw = await this.agileRequest<any>("get", "/board", undefined, params);
    const boards: JiraBoard[] = (raw.values ?? []).map((b: any) => ({
      id: b.id, name: b.name, type: b.type, projectKey: b.location?.projectKey ?? null,
    }));
    this.cache.set(cacheKey, boards);
    return boards;
  }

  async getSprintIssues(sprintId: number): Promise<JiraSprintIssue[]> {
    const cacheKey = `sprint:${sprintId}`;
    const cached = this.cache.get<JiraSprintIssue[]>(cacheKey);
    if (cached) { console.error(`[JiraClient] Cache hit for sprint:${sprintId}`); return cached; }
    console.error(`[JiraClient] Fetching issues for sprint ${sprintId}`);
    const raw = await this.agileRequest<any>("get", `/sprint/${sprintId}/issue`, undefined, {
      maxResults: 100, fields: "summary,status,assignee,issuetype",
    });
    const issues: JiraSprintIssue[] = (raw.issues ?? []).map((i: any) => ({
      key: i.key,
      summary: i.fields?.summary ?? "",
      status: i.fields?.status?.name ?? "Unknown",
      assignee: i.fields?.assignee?.displayName ?? null,
      type: i.fields?.issuetype?.name ?? "Unknown",
    }));
    this.cache.set(cacheKey, issues);
    return issues;
  }

  async createIssue(params: CreateIssueParams): Promise<JiraCreateIssueResult> {
    console.error(`[JiraClient] Creating ${sanitizeLog(params.issueType)} in project ${sanitizeLog(params.projectKey)}: "${sanitizeLog(params.summary)}"`);
    const fields: Record<string, unknown> = {
      project: { key: params.projectKey },
      issuetype: { name: params.issueType },
      summary: params.summary,
    };
    if (params.description) fields.description = params.description;
    if (params.assignee) fields.assignee = { accountId: params.assignee };
    if (params.priority) fields.priority = { name: params.priority };
    if (params.labels && params.labels.length > 0) fields.labels = params.labels;
    if (params.parentKey) fields.parent = { key: params.parentKey };
    const raw = await this.request<any>("post", "/issue", { fields });
    this.cache.clear();
    return { key: raw.key, id: raw.id, self: raw.self, summary: params.summary };
  }

  async searchUsers(query: string): Promise<JiraUser[]> {
    const cacheKey = `users:${query}`;
    const cached = this.cache.get<JiraUser[]>(cacheKey);
    if (cached) { console.error(`[JiraClient] Cache hit for user search: ${sanitizeLog(query)}`); return cached; }
    console.error(`[JiraClient] Searching users with query: ${sanitizeLog(query)}`);
    const raw = await this.request<any[]>("get", "/user/search", undefined, { query, maxResults: 10 });
    const users: JiraUser[] = (raw ?? []).map((u: any) => ({
      accountId: u.accountId,
      displayName: u.displayName ?? "",
      emailAddress: u.emailAddress ?? null,
      active: u.active ?? false,
    }));
    this.cache.set(cacheKey, users);
    return users;
  }

  async assignIssue(issueKey: string, accountId: string | null): Promise<JiraAssignResult> {
    console.error(`[JiraClient] Assigning ${sanitizeLog(issueKey)} to ${sanitizeLog(accountId ?? "unassigned")}`);
    await this.request<void>("put", `/issue/${encodeURIComponent(issueKey)}/assignee`, { accountId });
    this.cache.invalidate(`issue:${issueKey}`);
    this.cache.clear();
    let displayName = "Unassigned";
    if (accountId) {
      try {
        const users = await this.searchUsers(accountId);
        const match = users.find((u) => u.accountId === accountId);
        displayName = match?.displayName ?? accountId;
      } catch { displayName = accountId; }
    }
    return { success: true, issueKey, assignee: { accountId: accountId ?? "none", displayName } };
  }

  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    console.error(`[JiraClient] Fetching transitions for ${sanitizeLog(issueKey)}`);
    const raw = await this.request<any>("get", `/issue/${encodeURIComponent(issueKey)}/transitions`);
    return (raw.transitions ?? []).map((t: any) => ({ id: t.id, name: t.name }));
  }

  async updateIssue(issueKey: string, updates: { summary?: string; description?: string }): Promise<JiraUpdateIssueResult> {
    console.error(`[JiraClient] Updating ${sanitizeLog(issueKey)}`);
    const fields: Record<string, unknown> = {};
    if (updates.summary) fields.summary = updates.summary;
    if (updates.description) fields.description = updates.description;
    await this.request<void>("put", `/issue/${encodeURIComponent(issueKey)}`, { fields });
    this.cache.invalidate(`issue:${issueKey}`);
    this.cache.clear();
    return { success: true, issueKey, updatedFields: Object.keys(fields) };
  }

  async transitionIssue(issueKey: string, statusName: string): Promise<JiraTransitionResult> {
    console.error(`[JiraClient] Transitioning ${sanitizeLog(issueKey)} to "${sanitizeLog(statusName)}"`);
    const transitions = await this.getTransitions(issueKey);
    const match = transitions.find((t) => t.name.toLowerCase() === statusName.toLowerCase());
    if (!match) {
      const available = transitions.map((t) => t.name).join(", ");
      throw new Error(`No transition to "${statusName}" found for ${issueKey}. Available transitions: ${available}`);
    }
    await this.request<void>("post", `/issue/${encodeURIComponent(issueKey)}/transitions`, { transition: { id: match.id } });
    this.cache.invalidate(`issue:${issueKey}`);
    this.cache.clear();
    return { success: true, issueKey, transitionedTo: match.name };
  }
}
