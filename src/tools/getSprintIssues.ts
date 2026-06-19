import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for get_jira_sprint_issues input */
export const GetSprintIssuesInputSchema = z.object({
  sprintId: z
    .number()
    .int()
    .positive()
    .describe(
      "The numeric sprint ID. Use get_jira_boards to find boards, then look up sprints via their board ID."
    ),
});

export type GetSprintIssuesInput = z.infer<typeof GetSprintIssuesInputSchema>;

/** Handler: get all issues in a specific Jira sprint. */
export async function getSprintIssues(
  client: JiraClient,
  input: GetSprintIssuesInput
) {
  const issues = await client.getSprintIssues(input.sprintId);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(issues, null, 2),
      },
    ],
  };
}

