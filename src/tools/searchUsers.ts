import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for search_jira_users input */
export const SearchUsersInputSchema = z.object({
  query: z
    .string()
    .min(1, "query is required")
    .describe(
      "Search string to find Jira users — matches against display name, email, or account ID"
    ),
});

export type SearchUsersInput = z.infer<typeof SearchUsersInputSchema>;

/** Handler: search for Jira users and return their account IDs. */
export async function searchUsers(
  client: JiraClient,
  input: SearchUsersInput
) {
  const users = await client.searchUsers(input.query);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(users, null, 2),
      },
    ],
  };
}

