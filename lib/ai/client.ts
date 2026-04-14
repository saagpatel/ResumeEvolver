import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/env";
import { EvidenceError } from "@/lib/evidence/errors";

let cachedClient: OpenAI | null = null;

export function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    throw new EvidenceError(
      "OPENAI_API_KEY is not configured for AI generation.",
      503,
    );
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  return cachedClient;
}
