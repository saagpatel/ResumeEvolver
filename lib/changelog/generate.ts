import "server-only";

import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { EvidenceError } from "@/lib/evidence/errors";
import {
  changelogGeneratePromptVersion,
  changelogGenerationResultSchema,
  type ResolvedChangelogPeriod,
} from "./contracts";
import type { ApprovedEvidenceForChangelogGeneration } from "./queries";

const DEFAULT_CHANGELOG_MODEL = "gpt-4.1-mini";
const promptPath = path.join(
  process.cwd(),
  "prompts",
  `${changelogGeneratePromptVersion}.md`,
);

let cachedPrompt: string | null = null;
type ChangelogGenerationResult = z.infer<typeof changelogGenerationResultSchema>;

async function getPromptTemplate() {
  if (!cachedPrompt) {
    cachedPrompt = await readFile(promptPath, "utf8");
  }

  return cachedPrompt;
}

function buildChangelogInput(
  period: ResolvedChangelogPeriod,
  evidence: ApprovedEvidenceForChangelogGeneration[],
) {
  return JSON.stringify(
    {
      period: {
        type: period.periodType,
        start: period.periodStart,
        end: period.periodEnd,
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
        effective_date: row.effectiveDate,
      })),
    },
    null,
    2,
  );
}

function buildDeterministicTestChangelog(
  period: ResolvedChangelogPeriod,
  evidence: ApprovedEvidenceForChangelogGeneration[],
): ChangelogGenerationResult {
  const titles = evidence.slice(0, 3).map((row) => row.title);

  return {
    title:
      period.periodType === "quarterly"
        ? `Quarterly changelog for ${period.periodStart}`
        : `Monthly changelog for ${period.periodStart}`,
    sections: [
      {
        heading: "Highlights",
        bullets:
          titles.length > 0
            ? titles.map((title) => `Confirmed progress from ${title}.`)
            : ["Confirmed progress from approved evidence in this period."],
      },
    ],
  };
}

export function getChangelogGenerationModel() {
  return process.env.OPENAI_MODEL_CHANGELOG_GENERATE ?? DEFAULT_CHANGELOG_MODEL;
}

export async function generateChangelogDraft(
  period: ResolvedChangelogPeriod,
  evidence: ApprovedEvidenceForChangelogGeneration[],
): Promise<ChangelogGenerationResult> {
  if (process.env.RESUMEEVOLVER_TEST_MODE === "1") {
    return buildDeterministicTestChangelog(period, evidence);
  }

  const client = getOpenAIClient();
  const prompt = await getPromptTemplate();
  const response = await client.responses.parse({
    model: getChangelogGenerationModel(),
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
            text: `Draft one changelog entry only from this approved in-period evidence.\n\n${buildChangelogInput(
              period,
              evidence,
            )}`,
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(
        changelogGenerationResultSchema,
        "changelog_generation",
      ),
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
          item.refusal || "The changelog generation model refused this request.",
          502,
        );
      }
    }
  }

  throw new EvidenceError(
    "The changelog generation model did not return a usable structured response.",
    502,
  );
}
