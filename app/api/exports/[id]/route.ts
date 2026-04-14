import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { buildExportFilename, getExportContentType } from "@/lib/exports/contracts";
import { getExportById, getExportHistoryRecordById } from "@/lib/exports/queries";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const viewer = await getViewer();

  if (!viewer) {
    return new Response(JSON.stringify({ error: "Authentication required." }), {
      status: 401,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  const { id } = await context.params;
  const supabase = await createClient();
  const [exportRow, historyRecord] = await Promise.all([
    getExportById(supabase, viewer.userId, id),
    getExportHistoryRecordById(supabase, viewer.userId, id),
  ]);

  if (!exportRow || !historyRecord) {
    return new Response(JSON.stringify({ error: "Export not found." }), {
      status: 404,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  const fileName = buildExportFilename({
    targetType: exportRow.target_type,
    targetLabel: historyRecord.targetLabel,
    format: exportRow.format,
    createdAt: exportRow.created_at,
  });

  return new Response(exportRow.content, {
    status: 200,
    headers: {
      "Content-Type": getExportContentType(exportRow.format),
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
