import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for get_jira_issue input */
export const GetIssueInputSchema = z.object({
  issueKey: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/, "Invalid issue key format (e.g. PROJ-123)")
    .describe("The Jira issue key, e.g. PROJ-123"),
});

export type GetIssueInput = z.infer<typeof GetIssueInputSchema>;

/** Handler: fetch a single Jira issue and return structured data. */
export async function getIssue(client: JiraClient, input: GetIssueInput) {
  const issue = await client.getIssue(input.issueKey);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(issue, null, 2),
      },
    ],
  };
}

