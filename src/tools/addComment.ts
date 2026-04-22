import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for add_jira_comment input */
export const AddCommentInputSchema = z.object({
  issueKey: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/, "Invalid issue key format (e.g. PROJ-123)")
    .describe("The Jira issue key, e.g. PROJ-123"),
  comment: z
    .string()
    .min(1, "comment text is required")
    .describe("The comment body to add to the issue"),
});

export type AddCommentInput = z.infer<typeof AddCommentInputSchema>;

/** Handler: add a comment to a Jira issue. */
export async function addComment(client: JiraClient, input: AddCommentInput) {
  const result = await client.addComment(input.issueKey, input.comment);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

