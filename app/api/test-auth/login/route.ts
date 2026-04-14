import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const smokePassword = "resume-smoke-password";

function isTestAuthEnabled() {
  return process.env.NODE_ENV !== "production";
}

export async function POST() {
  if (!isTestAuthEnabled()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const supabase = await createClient();
  const smokeEmail = `resume-smoke-${randomUUID()}@example.com`;

  const signUp = await supabase.auth.signUp({
    email: smokeEmail,
    password: smokePassword,
    options: {
      data: {
        display_name: "Resume Smoke User",
      },
    },
  });

  if (signUp.error) {
    return NextResponse.json({ error: signUp.error.message }, { status: 400 });
  }

  if (!signUp.data.session) {
    const signIn = await supabase.auth.signInWithPassword({
      email: smokeEmail,
      password: smokePassword,
    });

    if (signIn.error) {
      return NextResponse.json({ error: signIn.error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
