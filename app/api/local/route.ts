import { normalizeArxivId } from "../../../lib/arxiv";
import { enqueueProfileUpdate, loadDashboardState, rollbackProfile, updatePaperState } from "../../../lib/research-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function assertLocal(request: Request) {
  const url = new URL(request.url);
  if (!LOCAL_HOSTS.has(url.hostname)) throw new Error("Lattice only accepts local requests.");
  const hostHeader = request.headers.get("host");
  if (hostHeader) {
    let hostname = "";
    try { hostname = new URL(`http://${hostHeader}`).hostname; } catch { throw new Error("Lattice only accepts valid local host headers."); }
    if (!LOCAL_HOSTS.has(hostname)) throw new Error("Lattice only accepts local host headers.");
  }
  const origin = request.headers.get("origin");
  if (origin) {
    const originUrl = new URL(origin);
    if (!LOCAL_HOSTS.has(originUrl.hostname) || originUrl.port !== url.port) throw new Error("Request origin is not allowed.");
  }
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected local storage error.";
  const status = /not found/i.test(message) ? 404 : /local|origin/i.test(message) ? 403 : 400;
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    assertLocal(request);
    return Response.json(await loadDashboardState(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    assertLocal(request);
    const form = await request.formData();
    const action = String(form.get("action") ?? "");
    if (action !== "enqueue-profile-update") throw new Error("Unknown local action.");
    const message = String(form.get("message") ?? "").trim().slice(0, 20_000);
    const arxivValue = String(form.get("arxiv") ?? "").trim();
    const arxivId = arxivValue ? normalizeArxivId(arxivValue).baseId : null;
    const note = String(form.get("note") ?? "").trim().slice(0, 5_000);
    const label = form.get("label") === "interested" ? "interested" : "core";
    const candidate = form.get("pdf");
    const pdf = candidate instanceof File && candidate.size > 0 ? candidate : null;
    if (!message && !arxivId && !pdf) throw new Error("Add a note, an arXiv link, or a PDF.");
    const item = await enqueueProfileUpdate({ message, arxivId, label, note, pdf });
    return Response.json({ item, message: "Saved locally — ask Codex to process the profile inbox." }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    assertLocal(request);
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "paper-state") {
      if (typeof body.id !== "string") throw new Error("Paper ID is required.");
      const paper = await updatePaperState({
        id: body.id,
        read: typeof body.read === "boolean" ? body.read : undefined,
        saved: typeof body.saved === "boolean" ? body.saved : undefined,
        personalTags: Array.isArray(body.personalTags) ? body.personalTags.filter((tag): tag is string => typeof tag === "string") : undefined,
        personalNote: typeof body.personalNote === "string" ? body.personalNote : undefined,
      });
      return Response.json({ paper });
    }
    if (body.action === "rollback-profile") {
      const version = Number(body.version);
      if (!Number.isInteger(version) || version < 1) throw new Error("A valid profile version is required.");
      return Response.json({ profile: await rollbackProfile(version) });
    }
    throw new Error("Unknown local action.");
  } catch (error) { return failure(error); }
}
