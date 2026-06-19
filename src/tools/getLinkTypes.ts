import { z } from "zod";
import { JiraClient } from "../jiraClient.js";

/** Schema for get_jira_link_types input (no parameters required) */
export const GetLinkTypesInputSchema = z.object({});

export type GetLinkTypesInput = z.infer<typeof GetLinkTypesInputSchema>;

/** Handler: get all available issue link types in Jira. */
export async function getLinkTypes(
  client: JiraClient,
  _input: GetLinkTypesInput
) {
  const linkTypes = await client.getLinkTypes();
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(linkTypes, null, 2),
      },
    ],
  };
}

