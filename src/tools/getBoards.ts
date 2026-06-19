import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for get_jira_boards input */
export const GetBoardsInputSchema = z.object({
  projectKey: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+$/, "Invalid project key format (e.g. PROJ)")
    .optional()
    .describe(
      "Optional Jira project key to filter boards (e.g. DEV). Omit to list all accessible boards."
    ),
});

export type GetBoardsInput = z.infer<typeof GetBoardsInputSchema>;

/** Handler: get Jira boards, optionally filtered by project key. */
export async function getBoards(client: JiraClient, input: GetBoardsInput) {
  const boards = await client.getBoards(input.projectKey);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(boards, null, 2),
      },
    ],
  };
}

