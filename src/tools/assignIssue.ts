import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for assign_jira_issue input */
export const AssignIssueInputSchema = z.object({
  issueKey: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/, "Invalid issue key format (e.g. PROJ-123)")
    .describe("The Jira issue key to assign, e.g. PROJ-123"),
  accountId: z
    .string()
    .min(1, "accountId is required")
    .describe(
      "The Atlassian account ID of the user to assign. Use search_jira_users to find this."
    ),
});

export type AssignIssueInput = z.infer<typeof AssignIssueInputSchema>;

/** Handler: assign a Jira issue to a user. */
export async function assignIssue(
  client: JiraClient,
  input: AssignIssueInput
) {
  const result = await client.assignIssue(input.issueKey, input.accountId);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

