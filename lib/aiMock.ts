import type { Job } from "./types";
import type { ScheduleEntry } from "./jobData";

export interface AiEstimateResult {
  estimatedHours: number;
  aiSuggestedMaterial: string;
}

export function generateAiEstimate(job: Job): AiEstimateResult {
  const resinLabel = job.resinType.includes("Isophthalic")
    ? "Isophthalic"
    : job.resinType.split(" ")[0];
  const resinKg =
    job.resinType === "Phenolic" ? 52 : job.resinType === "Vinyl Ester" ? 45 : 38;
  const hours =
    job.estimatedHours == null
      ? Math.round((15 + (job.projectName.length % 8)) * 10) / 10
      : Math.round((job.estimatedHours * 0.94 + (job.projectName.length % 5)) * 10) /
        10;

  return {
    estimatedHours: hours,
    aiSuggestedMaterial: `Requires ${resinKg}kg of ${resinLabel} Resin based on 3 similar jobs for ${job.clientName}`,
  };
}

export function getOptimizedSchedule(
  current: ScheduleEntry[]
): ScheduleEntry[] {
  const fabricators = ["M. Henderson", "S. Patel", "J. Morrison", "T. Williams"];
  const assignmentMap = Object.fromEntries(
    current.map((row, index) => [
      row.jobCode,
      {
        assignedTo: fabricators[index % fabricators.length],
        estimatedDate: row.estimatedDate,
      },
    ])
  );

  return [...current]
    .map((row) => {
      const optimized = assignmentMap[row.jobCode];
      if (!optimized) return row;
      return {
        ...row,
        estimatedDate: optimized.estimatedDate,
        assignedTo: optimized.assignedTo,
        completionPercent:
          row.completionPercent > 0 ? row.completionPercent : 5,
      };
    })
    .sort(
      (a, b) =>
        new Date(a.estimatedDate).getTime() -
        new Date(b.estimatedDate).getTime()
    );
}

export interface ParsedNaturalLanguageQuery {
  searchText: string;
  statusFilter?: Job["status"];
  clientHint?: string;
  priorityFilter?: Job["priority"];
  /** True when query looks like a sentence / voice command, not a simple ID search */
  isNaturalLanguage: boolean;
}

const CLIENT_ALIASES: { hint: string; match: string }[] = [
  { hint: "water corp", match: "water corp" },
  { hint: "rio tinto", match: "rio tinto" },
  { hint: "bhp", match: "bhp" },
  { hint: "fmg", match: "fmg" },
  { hint: "fortescue", match: "fortescue" },
];

function formatClientHint(hint: string): string {
  return hint
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function parseNaturalLanguageQuery(query: string): ParsedNaturalLanguageQuery {
  const raw = query.trim();
  const lower = raw.toLowerCase();
  let statusFilter: Job["status"] | undefined;
  let clientHint: string | undefined;
  let priorityFilter: Job["priority"] | undefined;
  let searchText = lower;

  const isNaturalLanguage =
    raw.length > 12 ||
    /\b(show|find|list|pending|ready|fabrication|rush|all)\b/i.test(raw);

  if (/\brush\b/i.test(lower)) {
    priorityFilter = "RUSH";
    searchText = searchText.replace(/\brush\b/gi, "").trim();
  }

  if (
    /\b(pending|awaiting approval|needs approval|waiting approval)\b/i.test(
      lower
    )
  ) {
    statusFilter = "Awaiting Manager Approval";
    searchText = searchText
      .replace(
        /\b(pending|awaiting approval|needs approval|waiting approval)\b/gi,
        ""
      )
      .trim();
  } else if (
    /\b(ready to manufacture|ready for floor|cleared for)\b/i.test(lower) ||
    (/\bready\b/i.test(lower) && !/\bnot ready\b/i.test(lower))
  ) {
    statusFilter = "Ready to Manufacture";
    searchText = searchText
      .replace(
        /\b(ready to manufacture|ready for floor|cleared for|ready)\b/gi,
        ""
      )
      .trim();
  } else if (
    /\b(in fabrication|on the bay|on bay|in progress|fabricating)\b/i.test(
      lower
    )
  ) {
    statusFilter = "In Fabrication";
    searchText = searchText
      .replace(
        /\b(in fabrication|on the bay|on bay|in progress|fabricating|fabrication)\b/gi,
        ""
      )
      .trim();
  }

  for (const { hint, match } of CLIENT_ALIASES) {
    if (lower.includes(hint)) {
      clientHint = match;
      searchText = searchText.replace(new RegExp(hint, "gi"), "").trim();
      break;
    }
  }

  searchText = searchText
    .replace(
      /\b(show me all|show me|show all|find all|find|list all|list|all jobs for|jobs for|for|please)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  return {
    searchText,
    statusFilter,
    clientHint,
    priorityFilter,
    isNaturalLanguage,
  };
}

/** Human-readable summary for the AI search banner */
export function describeParsedQuery(
  parsed: ParsedNaturalLanguageQuery
): string | null {
  if (!parsed.isNaturalLanguage && !parsed.statusFilter && !parsed.clientHint) {
    return null;
  }

  const parts: string[] = [];
  if (parsed.statusFilter) parts.push(parsed.statusFilter);
  if (parsed.clientHint) parts.push(`Client: ${formatClientHint(parsed.clientHint)}`);
  if (parsed.priorityFilter) parts.push(`${parsed.priorityFilter} priority`);

  if (parts.length === 0) {
    return parsed.searchText
      ? `Searching for “${parsed.searchText}”`
      : null;
  }

  return `AI filter active — ${parts.join(" · ")}`;
}
