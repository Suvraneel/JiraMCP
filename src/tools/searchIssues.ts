import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for search_jira_issues input */
export const SearchIssuesInputSchema = z.object({
  jql: z
    .string()
    .min(1, "jql query is required")
    .describe("A JQL query string, e.g. 'project = PROJ AND status = Open'"),
});

export type SearchIssuesInput = z.infer<typeof SearchIssuesInputSchema>;

/** Handler: search Jira issues via JQL and return an array of summaries. */
export async function searchIssues(
  client: JiraClient,
  input: SearchIssuesInput
) {
  const issues = await client.searchIssues(input.jql);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(issues, null, 2),
      },
    ],
  };
}

