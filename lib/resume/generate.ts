import "server-only";

import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { EvidenceError } from "@/lib/evidence/errors";
import type { RoleVariantRecord } from "@/lib/roles/queries";
import {
  resumeGeneratePromptVersion,
  resumeGenerationResultSchema,
} from "./contracts";
import type { ApprovedEvidenceForGeneration } from "./queries";

const DEFAULT_RESUME_MODEL = "gpt-4.1-mini";
const promptPath = path.join(
  process.cwd(),
  "prompts",
  `${resumeGeneratePromptVersion}.md`,
);

let cachedPrompt: string | null = null;
type ResumeGenerationResult = z.infer<typeof resumeGenerationResultSchema>;

async function getPromptTemplate() {
  if (!cachedPrompt) {
    cachedPrompt = await readFile(promptPath, "utf8");
  }

  return cachedPrompt;
}

function buildResumeInput(
  role: RoleVariantRecord,
  evidence: ApprovedEvidenceForGeneration[],
) {
  return JSON.stringify(
    {
      role_variant: {
        id: role.id,
        name: role.name,
        target_title: role.target_title,
        job_description_raw: role.job_description_raw,
        notes: role.notes,
      },
      selected_evidence: evidence.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        factual_summary: row.factual_summary,
        raw_input: row.raw_input,
        project_name: row.project_name,
        proof_strength: row.proof_strength,
        source_system: row.source_system,
        source_url: row.source_url,
        time_start: row.time_start,
        time_end: row.time_end,
        role_relevance: row.roleRelevance,
      })),
    },
    null,
    2,
  );
}

function buildDeterministicTestBullets(
  evidence: ApprovedEvidenceForGeneration[],
): ResumeGenerationResult {
  return {
    bullets: evidence.slice(0, 3).map((row, index) => ({
      draftText:
        index === 0
          ? `Shipped role-relevant work using ${row.title} with evidence-backed delivery details.`
          : `Turned ${row.title} into a concise, role-targeted draft supported by approved evidence.`,
      claimType: index === 0 ? "fact_backed" : "evidence_backed_inference",
      supportingEvidenceIds: [row.id],
    })),
  };
}

export function getResumeGenerationModel() {
  return process.env.OPENAI_MODEL_RESUME_GENERATE ?? DEFAULT_RESUME_MODEL;
}

export async function generateResumeBullets(
  role: RoleVariantRecord,
  evidence: ApprovedEvidenceForGeneration[],
): Promise<ResumeGenerationResult> {
  if (process.env.RESUMEEVOLVER_TEST_MODE === "1") {
    return buildDeterministicTestBullets(evidence);
  }

  const client = getOpenAIClient();
  const prompt = await getPromptTemplate();
  const response = await client.responses.parse({
    model: getResumeGenerationModel(),
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
            text: `Generate role-targeted resume bullets only from this approved evidence.\n\n${buildResumeInput(
              role,
              evidence,
            )}`,
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(resumeGenerationResultSchema, "resume_generation"),
    },
  });

  if (response.output_parsed) {
    return response.output_parsed;
  }

  for (const output of response.output) {
    if (output.type !== "message") {
      continue;
    }

    for (const item of output.content) {
      if (item.type === "refusal") {
        throw new EvidenceError(
          item.refusal || "The resume generation model refused this request.",
          502,
        );
      }
    }
  }

  throw new EvidenceError(
    "The resume generation model did not return a usable structured response.",
    502,
  );
}
