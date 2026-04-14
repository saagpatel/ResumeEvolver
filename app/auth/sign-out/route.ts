import { NextResponse } from "next/server";
import { clearGitHubImportCookie } from "@/lib/github/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearGitHubImportCookie(response);
  return response;
}
