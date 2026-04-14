import "server-only";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { zodTextFormat } from "openai/helpers/zod";
import { evidenceStructureSchema } from "@/lib/evidence/contracts";
import { EvidenceError } from "@/lib/evidence/errors";
import { getOpenAIClient } from "@/lib/ai/client";
import type { EvidenceRecordWithLinks } from "@/lib/evidence/queries";

const DEFAULT_STRUCTURE_MODEL = "gpt-4.1-mini";
const promptPath = path.join(
  process.cwd(),
  "prompts",
  "structure-evidence.v1.md",
);

let cachedPrompt: string | null = null;

async function getPromptTemplate() {
  if (!cachedPrompt) {
    cachedPrompt = await readFile(promptPath, "utf8");
  }

  return cachedPrompt;
}

function buildEvidenceInput(evidence: EvidenceRecordWithLinks) {
  return JSON.stringify(
    {
      id: evidence.id,
      type: evidence.type,
      title: evidence.title,
      raw_input: evidence.raw_input,
      factual_summary: evidence.factual_summary,
      project_name: evidence.project_name,
      time_start: evidence.time_start,
      time_end: evidence.time_end,
      source_system: evidence.source_system,
      source_url: evidence.source_url,
      metadata: evidence.metadata,
      links: evidence.links.map((link) => ({
        label: link.label,
        url: link.url,
        link_type: link.linkType,
      })),
    },
    null,
    2,
  );
}

export async function structureEvidence(evidence: EvidenceRecordWithLinks) {
  const client = getOpenAIClient();
  const prompt = await getPromptTemplate();

  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL_EVIDENCE_STRUCTURE ?? DEFAULT_STRUCTURE_MODEL,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: prompt }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Structure this evidence item without inventing facts.\n\n${buildEvidenceInput(
              evidence,
            )}`,
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(evidenceStructureSchema, "evidence_structure"),
    },
  });

  if (response.output_parsed) {
    return response.output_parsed;
  }

  throw new EvidenceError(
    "The structuring model did not return a usable structured response.",
    502,
  );
}
