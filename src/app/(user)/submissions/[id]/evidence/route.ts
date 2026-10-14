import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { EVIDENCE_BUCKET } from "@/lib/tasks/evidence";
import { createClient } from "@/lib/supabase/server";

const noStore = { "Cache-Control": "private, no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Signed URLs are short-lived so a leaked link stops working quickly. */
const SIGNED_URL_SECONDS = 60;

/**
 * GET /submissions/:id/evidence — redirect to a short-lived signed URL for the
 * evidence file. Access is decided by the database, using the caller's session:
 * RLS only returns the submission to its owner (or an admin), and storage RLS
 * only signs files in the owner's folder (or for an admin).
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/submissions/[id]/evidence">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401, headers: noStore });

  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });

  const supabase = await createClient();
  const { data: submission, error } = await supabase
    .from("task_submissions")
    .select("evidence_path")
    .eq("id", id)
    .maybeSingle();
  // Someone else's submission looks exactly like a missing one.
  if (error || !submission?.evidence_path) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(submission.evidence_path, SIGNED_URL_SECONDS);
  if (signError || !signed) {
    console.error("evidence: signing failed", signError?.message);
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
  }

  return NextResponse.redirect(signed.signedUrl, { status: 303, headers: noStore });
}
