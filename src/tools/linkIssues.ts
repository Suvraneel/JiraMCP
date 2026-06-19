import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for link_jira_issues input */
export const LinkIssuesInputSchema = z.object({
  outwardIssueKey: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/, "Invalid issue key format (e.g. PROJ-123)")
    .describe(
      'The outward issue key (e.g. the issue that "blocks" or "relates to" the other)'
    ),
  inwardIssueKey: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/, "Invalid issue key format (e.g. PROJ-123)")
    .describe(
      'The inward issue key (e.g. the issue that is "blocked by" or "related to")'
    ),
  linkType: z
    .string()
    .min(1, "linkType is required")
    .describe(
      'The name of the link type, e.g. "Blocks", "Cloners", "Duplicate", "Relates". Use get_jira_link_types to see all available types.'
    ),
});

export type LinkIssuesInput = z.infer<typeof LinkIssuesInputSchema>;

/** Handler: create a link between two Jira issues. */
export async function linkIssues(
  client: JiraClient,
  input: LinkIssuesInput
) {
  const result = await client.linkIssues(
    input.outwardIssueKey,
    input.inwardIssueKey,
    input.linkType
  );
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

