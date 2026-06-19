import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for get_jira_issue_changelog input */
export const GetIssueChangelogInputSchema = z.object({
  issueKey: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/, "Invalid issue key format (e.g. PROJ-123)")
    .describe("The Jira issue key to fetch changelog for, e.g. PROJ-123"),
});

export type GetIssueChangelogInput = z.infer<typeof GetIssueChangelogInputSchema>;

/** Handler: get the changelog (history of field changes) for a Jira issue. */
export async function getIssueChangelog(
  client: JiraClient,
  input: GetIssueChangelogInput
) {
  const changelog = await client.getIssueChangelog(input.issueKey);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(changelog, null, 2),
      },
    ],
  };
}

