// Auth0 FGA decides who may read which note or letter. The same code runs against a local
// OpenFGA server (no credentials) or Auth0 FGA (client credentials), picked by env vars.
import { CredentialsMethod, OpenFgaClient, type TupleKey } from "@openfga/sdk";
import { maybe, need } from "./env";

// JSON form of fga/model.fga
export const MODEL = {
  schema_version: "1.1",
  type_definitions: [
    { type: "user" },
    {
      type: "vault",
      relations: { owner: { this: {} }, released: { this: {} } },
      metadata: {
        relations: {
          owner: { directly_related_user_types: [{ type: "user" }] },
          released: { directly_related_user_types: [{ type: "user", wildcard: {} }] },
        },
      },
    },
    ...(["note", "letter"] as const).map((type) => {
      const holder = type === "note" ? "reader" : "recipient";
      return {
        type,
        relations: {
          vault: { this: {} },
          owner: { tupleToUserset: { tupleset: { relation: "vault" }, computedUserset: { relation: "owner" } } },
          [holder]: { this: {} },
          can_read: {
            union: {
              child: [
                { computedUserset: { relation: "owner" } },
                {
                  intersection: {
                    child: [
                      { computedUserset: { relation: holder } },
                      { tupleToUserset: { tupleset: { relation: "vault" }, computedUserset: { relation: "released" } } },
                    ],
                  },
                },
              ],
            },
          },
        },
        metadata: {
          relations: {
            vault: { directly_related_user_types: [{ type: "vault" }] },
            [holder]: { directly_related_user_types: [{ type: "user" }] },
          },
        },
      };
    }),
  ],
};

let client: OpenFgaClient | null = null;

export function fga(opts: { storeId?: string; modelId?: string } = {}) {
  if (client && !opts.storeId) return client;
  const clientId = maybe("FGA_CLIENT_ID");
  const c = new OpenFgaClient({
    apiUrl: need("FGA_API_URL"),
    storeId: opts.storeId ?? maybe("FGA_STORE_ID"),
    authorizationModelId: opts.modelId ?? maybe("FGA_MODEL_ID"),
    credentials: clientId
      ? {
          method: CredentialsMethod.ClientCredentials,
          config: {
            apiTokenIssuer: need("FGA_API_TOKEN_ISSUER"),
            apiAudience: need("FGA_API_AUDIENCE"),
            clientId,
            clientSecret: need("FGA_CLIENT_SECRET"),
          },
        }
      : undefined,
  });
  if (!opts.storeId) client = c;
  return c;
}

export const user = (personId: string) => `user:${personId}`;

async function write(tuples: TupleKey[]) {
  // The free tier allows 40 tuples per write
  for (let i = 0; i < tuples.length; i += 40) {
    await fga().writeTuples(tuples.slice(i, i + 40), { conflict: { onDuplicateWrites: "ignore" } } as never);
  }
}

async function remove(tuples: TupleKey[]) {
  for (let i = 0; i < tuples.length; i += 40) {
    await fga().deleteTuples(tuples.slice(i, i + 40), { conflict: { onMissingDeletes: "ignore" } } as never);
  }
}

export async function setVaultOwner(vaultId: string, ownerId: string) {
  await write([{ user: user(ownerId), relation: "owner", object: `vault:${vaultId}` }]);
}

// Replaces the reader list of one note with exactly `readers`
export async function shareNote(vaultId: string, noteId: string, readers: string[], previous: string[] = []) {
  const object = `note:${noteId}`;
  await write([
    { user: `vault:${vaultId}`, relation: "vault", object },
    ...readers.map((p) => ({ user: user(p), relation: "reader", object })),
  ]);
  const gone = previous.filter((p) => !readers.includes(p));
  if (gone.length) await remove(gone.map((p) => ({ user: user(p), relation: "reader", object })));
}

export async function shareLetter(vaultId: string, letterId: string, recipientId: string) {
  const object = `letter:${letterId}`;
  await write([
    { user: `vault:${vaultId}`, relation: "vault", object },
    { user: user(recipientId), relation: "recipient", object },
  ]);
}

const releasedTuple = (vaultId: string) => ({ user: "user:*", relation: "released", object: `vault:${vaultId}` });

export async function markReleased(vaultId: string) {
  await write([releasedTuple(vaultId)]);
}

export async function unmarkReleased(vaultId: string) {
  await remove([releasedTuple(vaultId)]);
}

// Checks many objects at once. Returns the ids the person may read, in input order.
export async function filterReadable(personId: string, kind: "note" | "letter", ids: string[]) {
  if (!ids.length) return [];
  const { result } = await fga().batchCheck({
    checks: ids.map((id, i) => ({ user: user(personId), relation: "can_read", object: `${kind}:${id}`, correlationId: `c${i}` })),
  });
  const allowed = new Set(result.filter((r) => r.allowed).map((r) => r.request.object.slice(kind.length + 1)));
  return ids.filter((id) => allowed.has(id));
}
