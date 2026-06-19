import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for get_jira_comments input */
export const GetCommentsInputSchema = z.object({
  issueKey: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/, "Invalid issue key format (e.g. PROJ-123)")
    .describe("The Jira issue key to fetch comments for, e.g. PROJ-123"),
});

export type GetCommentsInput = z.infer<typeof GetCommentsInputSchema>;

/** Handler: get all comments for a Jira issue. */
export async function getComments(
  client: JiraClient,
  input: GetCommentsInput
) {
  const comments = await client.getComments(input.issueKey);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(comments, null, 2),
      },
    ],
  };
}

