import { NextResponse } from "next/server";

type Payload = { name?: string; email?: string; brief?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: Payload;

  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const brief = body.brief?.trim() ?? "";

  if (!name || !EMAIL.test(email) || brief.length < 12) {
    return NextResponse.json(
      { error: "Check the highlighted fields and try again." },
      { status: 422 },
    );
  }

  // TODO: wire a transactional mail provider (Resend, Postmark, SES) here.
  // Until then the route validates and acknowledges without delivering mail.
  return NextResponse.json({ ok: true }, { status: 200 });
}
