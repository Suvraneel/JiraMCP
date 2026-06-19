#!/usr/bin/env node
/**
 * Jira MCP Server
 *
 * A Model Context Protocol server that exposes Jira tools for use
 * by GitHub Copilot Chat and other MCP-compatible clients.
 *
 * Transport: stdio (required by VS Code / Copilot Chat)
 */

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JiraClient } from "./jiraClient.js";

// Tool schemas & handlers
import { GetIssueInputSchema, getIssue } from "./tools/getIssue.js";
import {
  SearchIssuesInputSchema,
  searchIssues,
} from "./tools/searchIssues.js";
import { AddCommentInputSchema, addComment } from "./tools/addComment.js";
import {
  CreateIssueInputSchema,
  createIssue,
} from "./tools/createIssue.js";
import {
  AssignIssueInputSchema,
  assignIssue,
} from "./tools/assignIssue.js";
import {
  SearchUsersInputSchema,
  searchUsers as searchUsersHandler,
} from "./tools/searchUsers.js";
import {
  TransitionIssueInputSchema,
  transitionIssue,
} from "./tools/transitionIssue.js";
import {
  UpdateIssueInputSchema,
  updateIssue,
} from "./tools/updateIssue.js";
// New tools
import { GetCommentsInputSchema, getComments } from "./tools/getComments.js";
import {
  GetIssueChangelogInputSchema,
  getIssueChangelog,
} from "./tools/getIssueChangelog.js";
import { GetLinkTypesInputSchema, getLinkTypes } from "./tools/getLinkTypes.js";
import { LinkIssuesInputSchema, linkIssues } from "./tools/linkIssues.js";
import { GetBoardsInputSchema, getBoards } from "./tools/getBoards.js";
import {
  GetSprintIssuesInputSchema,
  getSprintIssues,
} from "./tools/getSprintIssues.js";
import { GetTransitionsInputSchema, getTransitions } from "./tools/getTransitions.js";

// ── Validate required environment variables ────────────────────────────────
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

if (!JIRA_BASE_URL || !JIRA_API_TOKEN) {
  console.error(
    "[Server] Missing required environment variables. " +
      "Please set JIRA_BASE_URL and JIRA_API_TOKEN in your .env file. " +
      "JIRA_EMAIL is optional (omit it to use Bearer/PAT auth)."
  );
  process.exit(1);
}

// ── Initialise Jira client ─────────────────────────────────────────────────
const jiraClient = new JiraClient(JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN);

// ── Create MCP server ──────────────────────────────────────────────────────
const server = new McpServer({
  name: "jira-mcp-server",
  version: "1.0.0",
});

// ── Helper to wrap a tool handler with standard error handling ─────────────
type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function wrapTool<T>(
  name: string,
  handler: (params: T) => Promise<ToolResult>
): (params: T) => Promise<ToolResult> {
  return async (params: T): Promise<ToolResult> => {
    try {
      return await handler(params);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${name}] Error: ${message.replace(/[\r\n\t]/g, " ").slice(0, 200)}`);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Error: ${message}` }],
      };
    }
  };
}

// ── Register tools ─────────────────────────────────────────────────────────

server.tool(
  "get_jira_issue",
  "Fetch a single Jira issue by its key (e.g. PROJ-123). Returns the issue key, summary, status, assignee, and description.",
  GetIssueInputSchema.shape,
  wrapTool("get_jira_issue", (p) => getIssue(jiraClient, p))
);

server.tool(
  "search_jira_issues",
  "Search for Jira issues using a JQL query. Returns an array of matching issues with key, summary, status, and assignee.",
  SearchIssuesInputSchema.shape,
  wrapTool("search_jira_issues", (p) => searchIssues(jiraClient, p))
);

server.tool(
  "add_jira_comment",
  "Add a new comment to a Jira issue, or edit an existing one. Omit commentId to add; provide commentId to edit.",
  AddCommentInputSchema.shape,
  wrapTool("add_jira_comment", (p) => addComment(jiraClient, p))
);

server.tool(
  "get_jira_comments",
  "Get all comments on a Jira issue. Returns id, author, body, created, and updated timestamps for each comment.",
  GetCommentsInputSchema.shape,
  wrapTool("get_jira_comments", (p) => getComments(jiraClient, p))
);

server.tool(
  "create_jira_issue",
  "Create a new Jira issue (Story, Task, Bug, Epic, or Sub-task). Requires project key, issue type, and summary. Optionally accepts description, assignee (account ID), priority, labels, and parent key.",
  CreateIssueInputSchema.shape,
  wrapTool("create_jira_issue", (p) => createIssue(jiraClient, p))
);

server.tool(
  "assign_jira_issue",
  "Assign a Jira issue to a user. Requires the issue key and the assignee's Atlassian account ID. Use search_jira_users first to find the account ID.",
  AssignIssueInputSchema.shape,
  wrapTool("assign_jira_issue", (p) => assignIssue(jiraClient, p))
);

server.tool(
  "search_jira_users",
  "Search for Jira users by display name or email. Returns matching users with their Atlassian account IDs. Useful for finding the accountId needed by assign_jira_issue and create_jira_issue.",
  SearchUsersInputSchema.shape,
  wrapTool("search_jira_users", (p) => searchUsersHandler(jiraClient, p))
);

server.tool(
  "get_jira_transitions",
  "List all available workflow transitions for a Jira issue (e.g. To Do, In Progress, Done). Use this before calling transition_jira_issue to see valid target statuses.",
  GetTransitionsInputSchema.shape,
  wrapTool("get_jira_transitions", (p) => getTransitions(jiraClient, p))
);

server.tool(
  "transition_jira_issue",
  'Transition a Jira issue to a new status (e.g. "To Do", "In Progress", "Done"). Automatically finds the correct transition ID. Returns the new status on success.',
  TransitionIssueInputSchema.shape,
  wrapTool("transition_jira_issue", (p) => transitionIssue(jiraClient, p))
);

server.tool(
  "update_jira_issue",
  "Update a Jira issue's summary and/or description. Requires the issue key and at least one field to update.",
  UpdateIssueInputSchema.shape,
  wrapTool("update_jira_issue", (p) => updateIssue(jiraClient, p))
);

server.tool(
  "get_jira_issue_changelog",
  "Get the full change history of a Jira issue — every field change with author, timestamp, old value, and new value.",
  GetIssueChangelogInputSchema.shape,
  wrapTool("get_jira_issue_changelog", (p) => getIssueChangelog(jiraClient, p))
);

server.tool(
  "get_jira_link_types",
  "List all available issue link types in Jira (e.g. Blocks, Cloners, Duplicate, Relates). Use these names when calling link_jira_issues.",
  GetLinkTypesInputSchema.shape,
  wrapTool("get_jira_link_types", (p) => getLinkTypes(jiraClient, p))
);

server.tool(
  "link_jira_issues",
  'Create a link between two Jira issues using a named link type (e.g. "Blocks", "Relates"). Use get_jira_link_types to discover available types.',
  LinkIssuesInputSchema.shape,
  wrapTool("link_jira_issues", (p) => linkIssues(jiraClient, p))
);

server.tool(
  "get_jira_boards",
  "List Jira boards (Scrum/Kanban), optionally filtered by project key. Returns board IDs needed for sprint lookups.",
  GetBoardsInputSchema.shape,
  wrapTool("get_jira_boards", (p) => getBoards(jiraClient, p))
);

server.tool(
  "get_jira_sprint_issues",
  "Get all issues in a specific Jira sprint by sprint ID. Returns key, summary, status, assignee, and issue type.",
  GetSprintIssuesInputSchema.shape,
  wrapTool("get_jira_sprint_issues", (p) => getSprintIssues(jiraClient, p))
);

// ── Start the server ───────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  console.error("[Server] Jira MCP Server starting…");
  await server.connect(transport);
  console.error("[Server] Jira MCP Server running on stdio transport.");
}

main().catch((err) => {
  console.error("[Server] Fatal error:", err);
  process.exit(1);
});
