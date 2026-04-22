import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for update_jira_issue input */
export const UpdateIssueInputSchema = z.object({
  issueKey: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/, "Invalid issue key format (e.g. PROJ-123)")
    .describe("The Jira issue key to update, e.g. PROJ-123"),
  summary: z
    .string()
    .optional()
    .describe("New summary/title for the issue"),
  description: z
    .string()
    .optional()
    .describe("New description for the issue"),
});

export type UpdateIssueInput = z.infer<typeof UpdateIssueInputSchema>;

/** Handler: update a Jira issue's summary and/or description. */
export async function updateIssue(
  client: JiraClient,
  input: UpdateIssueInput
) {
  const result = await client.updateIssue(input.issueKey, {
    summary: input.summary,
    description: input.description,
  });
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
