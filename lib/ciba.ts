// Auth0 Client-Initiated Backchannel Authentication: ask a trusted person on their phone
// (Auth0 Guardian push) to confirm, then poll for the answer. Ported from Sloth Errands.
import { need } from "./env";

const domain = () => need("AUTH0_DOMAIN").replace(/^https?:\/\//, "").replace(/\/$/, "");
const client = () => ({ client_id: need("AUTH0_CLIENT_ID"), client_secret: need("AUTH0_CLIENT_SECRET") });

async function post(path: string, body: Record<string, string>) {
  const res = await fetch(`https://${domain()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, any> };
}

// binding_message: max 64 chars, letters, digits, spaces and +-_.,:#
export function bindingMessage(text: string) {
  return text.replace(/[^A-Za-z0-9 +\-_.,:#]/g, "").replace(/\s+/g, " ").trim().slice(0, 64);
}

export async function startApproval(userSub: string, message: string, expirySeconds = 300) {
  const { status, json } = await post("/bc-authorize", {
    ...client(),
    scope: "openid",
    login_hint: JSON.stringify({ format: "iss_sub", iss: `https://${domain()}/`, sub: userSub }),
    binding_message: bindingMessage(message),
    requested_expiry: String(expirySeconds),
  });
  if (status !== 200) throw new Error(`CIBA start failed: ${json.error} ${json.error_description ?? ""}`);
  return { authReqId: json.auth_req_id as string, expiresIn: json.expires_in as number, interval: json.interval as number };
}

export type ApprovalState = "pending" | "approved" | "denied" | "expired";

export async function checkApproval(authReqId: string): Promise<ApprovalState> {
  const { status, json } = await post("/oauth/token", {
    ...client(),
    grant_type: "urn:openid:params:grant-type:ciba",
    auth_req_id: authReqId,
  });
  if (status === 200 && json.access_token) return "approved";
  if (json.error === "authorization_pending" || json.error === "slow_down") return "pending";
  if (json.error === "expired_token" || json.error === "invalid_grant") return "expired";
  if (json.error === "access_denied") {
    // Auth0 uses access_denied for both "denied" and "expired"
    return /expired/i.test(json.error_description ?? "") ? "expired" : "denied";
  }
  throw new Error(`CIBA check failed: ${json.error} ${json.error_description ?? ""}`);
}
