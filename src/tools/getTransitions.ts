import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for get_jira_transitions input */
export const GetTransitionsInputSchema = z.object({
  issueKey: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/, "Invalid issue key format (e.g. PROJ-123)")
    .describe(
      "The Jira issue key to list available transitions for, e.g. PROJ-123"
    ),
});

export type GetTransitionsInput = z.infer<typeof GetTransitionsInputSchema>;

/** Handler: list all available workflow transitions for a Jira issue. */
export async function getTransitions(
  client: JiraClient,
  input: GetTransitionsInput
) {
  const transitions = await client.getTransitions(input.issueKey);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(transitions, null, 2),
      },
    ],
  };
}

