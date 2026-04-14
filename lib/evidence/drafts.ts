import type { LinkType, ManualEvidenceType } from "@/types/domain";
import type { EvidenceRecordWithLinks } from "@/lib/evidence/queries";

export interface EvidenceLinkDraft {
  label: string;
  url: string;
  linkType: LinkType;
}

export interface ManualEvidenceDraft {
  type: ManualEvidenceType;
  title: string;
  rawInput: string;
  projectName: string;
  timeStart: string;
  timeEnd: string;
  links: EvidenceLinkDraft[];
}

export function createEmptyManualEvidenceDraft(): ManualEvidenceDraft {
  return {
    type: "manual_note",
    title: "",
    rawInput: "",
    projectName: "",
    timeStart: "",
    timeEnd: "",
    links: [],
  };
}

export function createEmptyEvidenceLinkDraft(): EvidenceLinkDraft {
  return {
    label: "",
    url: "",
    linkType: "external",
  };
}

export function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - timezoneOffset * 60_000);

  return localDate.toISOString().slice(0, 16);
}

export function toManualEvidenceDraft(
  evidence: EvidenceRecordWithLinks,
): ManualEvidenceDraft {
  return {
    type: evidence.type as ManualEvidenceType,
    title: evidence.title,
    rawInput: evidence.raw_input,
    projectName: evidence.project_name ?? "",
    timeStart: toDateTimeLocalValue(evidence.time_start),
    timeEnd: toDateTimeLocalValue(evidence.time_end),
    links: evidence.links.map((link) => ({
      label: link.label,
      url: link.url,
      linkType: link.linkType,
    })),
  };
}

export function toManualEvidencePayload(draft: ManualEvidenceDraft) {
  return {
    type: draft.type,
    title: draft.title,
    rawInput: draft.rawInput,
    projectName: draft.projectName || null,
    timeStart: draft.timeStart || null,
    timeEnd: draft.timeEnd || null,
    links: draft.links
      .filter((link) => link.label.trim() || link.url.trim())
      .map((link) => ({
        label: link.label,
        url: link.url,
        linkType: link.linkType,
      })),
  };
}
