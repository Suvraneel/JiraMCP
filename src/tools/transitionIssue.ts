import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for transition_jira_issue input */
export const TransitionIssueInputSchema = z.object({
  issueKey: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/, "Invalid issue key format (e.g. PROJ-123)")
    .describe("The Jira issue key to transition, e.g. PROJ-123"),
  status: z
    .string()
    .min(1, "status is required")
    .describe(
      'The target status name, e.g. "To Do", "In Progress", "Done". Must match an available transition for the issue.'
    ),
});

export type TransitionIssueInput = z.infer<typeof TransitionIssueInputSchema>;

/** Handler: transition a Jira issue to a new status. */
export async function transitionIssue(
  client: JiraClient,
  input: TransitionIssueInput
) {
  const result = await client.transitionIssue(input.issueKey, input.status);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

