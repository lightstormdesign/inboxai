import "server-only";

/**
 * Buffer GraphQL API (https://developers.buffer.com). As of 2026 it's in
 * public beta and authenticates with a per-account API key — third-party
 * OAuth isn't available yet, so each customer pastes their own key, which we
 * store encrypted. When Buffer ships OAuth, swap `apiKey` for an OAuth token.
 *
 * Query shapes follow Buffer's published examples; verify against their
 * schema explorer if a field errors (the API is still in beta).
 */
const ENDPOINT = "https://api.buffer.com";

export class BufferError extends Error {}

async function gql<T>(apiKey: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || json.errors?.length) {
    throw new BufferError(json.errors?.map((e) => e.message).join("; ") || `Buffer API ${res.status}`);
  }
  return json.data as T;
}

export type BufferOrganization = { id: string; name: string };
export type BufferChannel = { id: string; name: string; service: string; avatar?: string | null };

export async function getOrganizations(apiKey: string): Promise<BufferOrganization[]> {
  const data = await gql<{ account: { organizations: BufferOrganization[] } }>(
    apiKey,
    `query { account { organizations { id name } } }`,
  );
  return data.account.organizations;
}

export async function getChannels(apiKey: string, organizationId: string): Promise<BufferChannel[]> {
  const data = await gql<{ channels: BufferChannel[] }>(
    apiKey,
    `query Channels($organizationId: OrganizationId!) {
       channels(input: { organizationId: $organizationId }) { id name service avatar }
     }`,
    { organizationId },
  );
  return data.channels;
}

export async function createPost(
  apiKey: string,
  input: { channelId: string; text: string; dueAt?: Date; imageUrl?: string },
): Promise<{ id: string; dueAt: string | null }> {
  const data = await gql<{
    createPost: { post?: { id: string; dueAt: string | null }; message?: string };
  }>(
    apiKey,
    `mutation CreatePost($input: CreatePostInput!) {
       createPost(input: $input) {
         ... on PostActionSuccess { post { id dueAt } }
         ... on MutationError { message }
       }
     }`,
    {
      input: {
        channelId: input.channelId,
        text: input.text,
        schedulingType: "automatic",
        mode: input.dueAt ? "customScheduled" : "addToQueue",
        ...(input.dueAt ? { dueAt: input.dueAt.toISOString() } : {}),
        ...(input.imageUrl ? { assets: { images: [{ url: input.imageUrl }] } } : {}),
      },
    },
  );
  if (!data.createPost.post) throw new BufferError(data.createPost.message ?? "Buffer rejected the post");
  return data.createPost.post;
}
