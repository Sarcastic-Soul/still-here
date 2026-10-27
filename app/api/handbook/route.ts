// The owner downloads the latest handbook .docx.
import { sql } from "@/lib/db";
import { fail } from "@/lib/http";
import { currentPeople } from "@/lib/session";

export async function GET() {
  const owner = (await currentPeople()).find((p) => p.role === "owner");
  if (!owner) return fail("Only the owner can download the handbook.", 403);
  const [h] = await sql`select docx from handbooks where vault_id = ${owner.vault_id} and docx is not null order by created_at desc limit 1`;
  if (!h) return fail("No handbook yet.", 404);
  return new Response(new Uint8Array(h.docx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="what-my-family-needs-to-know.docx"',
    },
  });
}
