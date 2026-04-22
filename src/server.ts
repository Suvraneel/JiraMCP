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

// ── Register tools ─────────────────────────────────────────────────────────

server.tool(
  "get_jira_issue",
  "Fetch a single Jira issue by its key (e.g. PROJ-123). Returns the issue key, summary, status, assignee, and description.",
  GetIssueInputSchema.shape,
  async (params) => {
    try {
      return await getIssue(jiraClient, params);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[get_jira_issue] Error: ${message.replace(/[\r\n\t]/g, " ").slice(0, 200)}`);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Error: ${message}` }],
      };
    }
  }
);

server.tool(
  "search_jira_issues",
  "Search for Jira issues using a JQL query. Returns an array of matching issues with key, summary, status, and assignee.",
  SearchIssuesInputSchema.shape,
  async (params) => {
    try {
      return await searchIssues(jiraClient, params);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[search_jira_issues] Error: ${message.replace(/[\r\n\t]/g, " ").slice(0, 200)}`);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Error: ${message}` }],
      };
    }
  }
);

server.tool(
  "add_jira_comment",
  "Add a comment to an existing Jira issue. Requires the issue key and the comment text.",
  AddCommentInputSchema.shape,
  async (params) => {
    try {
      return await addComment(jiraClient, params);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[add_jira_comment] Error: ${message.replace(/[\r\n\t]/g, " ").slice(0, 200)}`);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Error: ${message}` }],
      };
    }
  }
);

server.tool(
  "create_jira_issue",
  "Create a new Jira issue (Story, Task, Bug, Epic, or Sub-task). Requires project key, issue type, and summary. Optionally accepts description, assignee (account ID), priority, labels, and parent key.",
  CreateIssueInputSchema.shape,
  async (params) => {
    try {
      return await createIssue(jiraClient, params);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[create_jira_issue] Error: ${message.replace(/[\r\n\t]/g, " ").slice(0, 200)}`);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Error: ${message}` }],
      };
    }
  }
);

server.tool(
  "search_jira_users",
  "Search for Jira users by display name or email. Returns matching users with their Atlassian account IDs. Useful for finding the accountId needed by assign_jira_issue and create_jira_issue.",
  SearchUsersInputSchema.shape,
  async (params) => {
    try {
      return await searchUsersHandler(jiraClient, params);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[search_jira_users] Error: ${message.replace(/[\r\n\t]/g, " ").slice(0, 200)}`);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Error: ${message}` }],
      };
    }
  }
);

server.tool(
  "assign_jira_issue",
  "Assign a Jira issue to a user. Requires the issue key and the assignee's Atlassian account ID. Use search_jira_users first to find the account ID.",
  AssignIssueInputSchema.shape,
  async (params) => {
    try {
      return await assignIssue(jiraClient, params);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[assign_jira_issue] Error: ${message.replace(/[\r\n\t]/g, " ").slice(0, 200)}`);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Error: ${message}` }],
      };
    }
  }
);

server.tool(
  "transition_jira_issue",
  'Transition a Jira issue to a new status (e.g. "To Do", "In Progress", "Done"). Automatically finds the correct transition ID. Returns the new status on success.',
  TransitionIssueInputSchema.shape,
  async (params) => {
    try {
      return await transitionIssue(jiraClient, params);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[transition_jira_issue] Error: ${message.replace(/[\r\n\t]/g, " ").slice(0, 200)}`);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Error: ${message}` }],
      };
    }
  }
);

server.tool(
  "update_jira_issue",
  "Update a Jira issue's summary and/or description. Requires the issue key and at least one field to update.",
  UpdateIssueInputSchema.shape,
  async (params) => {
    try {
      return await updateIssue(jiraClient, params);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[update_jira_issue] Error: ${message.replace(/[\r\n\t]/g, " ").slice(0, 200)}`);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Error: ${message}` }],
      };
    }
  }
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

