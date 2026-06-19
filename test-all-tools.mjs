import "dotenv/config";
import { JiraClient } from "./dist/jiraClient.js";
import axios from "axios";

const BASE_URL  = process.env.JIRA_BASE_URL;
const EMAIL     = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;

if (!BASE_URL || !API_TOKEN) { console.error("Missing env vars"); process.exit(1); }

const client = new JiraClient(BASE_URL, EMAIL, API_TOKEN);
let passed = 0, failed = 0;

function sep(n, title) {
  const line = "=".repeat(62);
  console.log("\n" + line + "\n  " + n + "  " + title + "\n" + line);
}
function ok(label, data) {
  passed++;
  console.log("\nPASS  " + label);
  console.log(JSON.stringify(data, null, 2));
  return data;
}
function fail(label, msg) {
  failed++;
  console.log("\nFAIL  " + label);
  console.log("   Reason: " + msg);
}
async function run(label, fn) {
  try { return ok(label, await fn()); }
  catch(e) { fail(label, e?.message ?? String(e)); return null; }
}

async function main() {
  console.log("\nJira MCP - Live Tool Test");
  console.log("Instance: " + BASE_URL);
  console.log("Auth    : " + EMAIL);

  sep("1", "get_jira_boards");
  const boards = await run("getBoards - all boards", () => client.getBoards());
  const board = boards?.[0] ?? null;
  const projectKey = board?.projectKey ?? null;
  console.log("\n   Board: " + board?.name + " (ID:" + board?.id + ")  Project: " + projectKey);

  sep("2", "search_jira_issues");
  const jql = projectKey
    ? "project = " + projectKey + " ORDER BY created DESC"
    : "ORDER BY updated DESC";
  const issues = await run("searchIssues [" + jql + "]", () => client.searchIssues(jql));
  const firstIssue = issues?.[0] ?? null;
  const secondIssue = issues?.[1] ?? null;
  const issueKey = firstIssue?.key ?? null;
  console.log("\n   First issue: " + issueKey);

  sep("3", "get_jira_issue");
  if (issueKey) {
    await run("getIssue " + issueKey, () => client.getIssue(issueKey));
  } else { fail("getIssue", "no issue key found"); }

  sep("4", "get_jira_comments");
  if (issueKey) {
    await run("getComments " + issueKey, () => client.getComments(issueKey));
  } else { fail("getComments", "no issue key"); }

  sep("5a", "add_jira_comment - ADD new comment");
  let commentId = null;
  if (issueKey) {
    const r = await run("addComment on " + issueKey,
      () => client.addComment(issueKey,
        "[MCP Test] Automated comment by JiraMCP tool-test suite. TS: " + new Date().toISOString()));
    commentId = r?.commentId ?? null;
    console.log("\n   New comment ID: " + commentId);
  } else { fail("addComment", "no issue key"); }

  sep("5b", "add_jira_comment - EDIT existing comment");
  if (issueKey && commentId) {
    await run("editComment " + commentId + " on " + issueKey,
      () => client.editComment(issueKey, commentId,
        "[MCP Test] EDITED by JiraMCP suite. Edited at: " + new Date().toISOString()));
  } else { fail("editComment", "no commentId (add step failed)"); }

  sep("6", "get_jira_issue_changelog");
  if (issueKey) {
    await run("getIssueChangelog " + issueKey, () => client.getIssueChangelog(issueKey));
  } else { fail("getIssueChangelog", "no issue key"); }

  sep("7", "get_jira_transitions");
  let transitions = null;
  if (issueKey) {
    transitions = await run("getTransitions " + issueKey, () => client.getTransitions(issueKey));
  } else { fail("getTransitions", "no issue key"); }

  sep("8", "transition_jira_issue");
  if (issueKey && transitions?.length > 0) {
    const cur = firstIssue?.status ?? "";
    const tgt = transitions.find(t => t.name.toLowerCase() !== cur.toLowerCase());
    if (tgt) {
      await run("transitionIssue " + issueKey + " -> [" + tgt.name + "]",
        () => client.transitionIssue(issueKey, tgt.name));
      const rev = transitions.find(t => t.name.toLowerCase() === cur.toLowerCase());
      if (rev) {
        await run("transitionIssue revert -> [" + rev.name + "]",
          () => client.transitionIssue(issueKey, rev.name));
      }
    } else { fail("transitionIssue", "only one status available: " + cur); }
  } else { fail("transitionIssue", "no transitions or no issue key"); }

  sep("9", "update_jira_issue");
  if (issueKey && firstIssue) {
    const orig = firstIssue.summary;
    await run("updateIssue " + issueKey + " - change summary+description",
      () => client.updateIssue(issueKey, {
        summary: orig + " [MCP-TEST-" + Date.now() + "]",
        description: "Updated by JiraMCP test suite at " + new Date().toISOString()
      }));
    await run("updateIssue " + issueKey + " - restore original summary",
      () => client.updateIssue(issueKey, { summary: orig }));
  } else { fail("updateIssue", "no issue key"); }

  sep("10", "get_jira_link_types");
  const linkTypes = await run("getLinkTypes", () => client.getLinkTypes());

  sep("11", "link_jira_issues");
  if (issueKey && secondIssue && linkTypes?.length) {
    await run("linkIssues Relates: " + issueKey + " <-> " + secondIssue.key,
      () => client.linkIssues(issueKey, secondIssue.key, "Relates"));
  } else {
    fail("linkIssues", "need >=2 issues. got=" + (issues?.length ?? 0));
  }

  sep("12", "search_jira_users");
  const q = EMAIL?.split("@")[0] ?? "admin";
  const users = await run("searchUsers [" + q + "]", () => client.searchUsers(q));
  const acct = users?.[0]?.accountId ?? null;
  console.log("\n   Account ID: " + acct);

  sep("13", "assign_jira_issue");
  if (issueKey && acct) {
    await run("assignIssue " + issueKey + " to " + users[0].displayName,
      () => client.assignIssue(issueKey, acct));
  } else { fail("assignIssue", "no account ID"); }

  sep("14", "create_jira_issue");
  let newKey = null;
  const pk = projectKey ?? issueKey?.split("-")[0];
  if (pk) {
    const r = await run("createIssue Task in " + pk, () => client.createIssue({
      projectKey: pk,
      issueType: "Task",
      summary: "[MCP Test] Auto-created by JiraMCP suite - " + new Date().toISOString(),
      description: "Created by JiraMCP end-to-end test suite. Safe to delete.",
      priority: "Low",
      labels: ["mcp-test"]
    }));
    newKey = r?.key ?? null;
    if (newKey) console.log("\n   Created: " + BASE_URL + "/browse/" + newKey);
  } else { fail("createIssue", "cannot determine project key"); }

  sep("15", "get_jira_sprint_issues");
  if (board?.id) {
    const auth = EMAIL
      ? "Basic " + Buffer.from(EMAIL + ":" + API_TOKEN).toString("base64")
      : "Bearer " + API_TOKEN;
    await run("getSprintIssues on board " + board.id, async () => {
      const resp = await axios.get(
        BASE_URL + "/rest/agile/1.0/board/" + board.id + "/sprint",
        {
          headers: { Authorization: auth, Accept: "application/json" },
          params: { state: "active,closed", maxResults: 1 }
        }
      );
      const sprint = resp.data?.values?.[0];
      if (!sprint) throw new Error("No sprint found for board " + board.id);
      console.log("\n   Sprint: " + sprint.name + " (ID:" + sprint.id + " state:" + sprint.state + ")");
      return client.getSprintIssues(sprint.id);
    });
  } else { fail("getSprintIssues", "no board available"); }

  const line = "=".repeat(62);
  console.log("\n" + line);
  console.log("  RESULTS  PASS=" + passed + "  FAIL=" + failed + "  TOTAL=" + (passed + failed));
  if (newKey) console.log("  Test issue: " + BASE_URL + "/browse/" + newKey + "  (label: mcp-test)");
  console.log(line + "\n");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("Crash:", e); process.exit(1); });
