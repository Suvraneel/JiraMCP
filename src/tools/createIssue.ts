import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for create_jira_issue input */
export const CreateIssueInputSchema = z.object({
  projectKey: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+$/, "Invalid project key format (e.g. PROJ)")
    .describe("The Jira project key (e.g. DEV, PROJ)"),
  issueType: z
    .string()
    .min(1, "issueType is required")
    .describe('The issue type: "Story", "Task", "Bug", "Epic", or "Sub-task"'),
  summary: z
    .string()
    .min(1, "summary is required")
    .describe("A brief summary / title for the issue"),
  description: z
    .string()
    .optional()
    .describe("Optional detailed description of the issue (plain text)"),
  assignee: z
    .string()
    .optional()
    .describe("Optional Atlassian account ID of the assignee"),
  priority: z
    .string()
    .optional()
    .describe('Optional priority name: "Highest", "High", "Medium", "Low", "Lowest"'),
  labels: z
    .array(z.string())
    .optional()
    .describe("Optional array of labels to attach to the issue"),
  parentKey: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/, "Invalid parent key format (e.g. DEV-5)")
    .optional()
    .describe("Optional parent issue key for sub-tasks or child issues (e.g. DEV-5)"),
});

export type CreateIssueInput = z.infer<typeof CreateIssueInputSchema>;

/** Handler: create a new Jira issue and return structured data. */
export async function createIssue(
  client: JiraClient,
  input: CreateIssueInput
) {
  const result = await client.createIssue(input);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

