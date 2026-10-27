import { auth0 } from "./auth0";
import { personForSession, type Person } from "./vault";

// The people rows (one per vault) for whoever is signed in
export async function currentPeople(): Promise<Person[]> {
  const session = await auth0.getSession();
  if (!session?.user) return [];
  return personForSession({ sub: session.user.sub, email: session.user.email, email_verified: session.user.email_verified as boolean | undefined });
}
