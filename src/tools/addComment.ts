import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for add_jira_comment / edit_jira_comment input */
export const AddCommentInputSchema = z.object({
  issueKey: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/, "Invalid issue key format (e.g. PROJ-123)")
    .describe("The Jira issue key, e.g. PROJ-123"),
  comment: z
    .string()
    .min(1, "comment text is required")
    .describe("The comment body to add or update on the issue"),
  commentId: z
    .string()
    .optional()
    .describe(
      "If provided, edits the existing comment with this ID instead of adding a new one"
    ),
});

export type AddCommentInput = z.infer<typeof AddCommentInputSchema>;

/**
 * Handler: add a new comment to a Jira issue, or edit an existing one.
 * - Omit `commentId` to add a new comment.
 * - Provide `commentId` to edit an existing comment.
 */
export async function addComment(client: JiraClient, input: AddCommentInput) {
  let result: object;

  if (input.commentId) {
    result = await client.editComment(
      input.issueKey,
      input.commentId,
      input.comment
    );
  } else {
    result = await client.addComment(input.issueKey, input.comment);
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

