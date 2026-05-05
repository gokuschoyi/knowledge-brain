import { Link } from "react-router-dom";

import { Document } from "../../api/documents";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";

export function DocumentList({
  documents,
  onRetry,
  onDelete,
  busyDocumentId,
}: {
  documents: Document[];
  onRetry?: (id: number) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  busyDocumentId?: number | null;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Recent documents</h3>
        <Badge>{documents.length} total</Badge>
      </div>
      <div className="space-y-3">
        {documents.map((document) => (
          <div key={document.id} className="rounded-md border border-slate-800 px-3 py-3 hover:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <Link to={`/documents/${document.id}`} className="min-w-0 flex-1">
                <div className="font-medium text-white">{document.title}</div>
              </Link>
              <Badge>{document.status}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
              <span>{document.llm_provider || "provider?"}</span>
              <span>{document.llm_model || "model?"}</span>
            </div>
            <Link to={`/documents/${document.id}`} className="block">
              <div className="mt-2 text-sm text-slate-400">{document.summary || "No summary yet."}</div>
              {document.error_message ? (
                <div className="mt-2 text-sm text-rose-300">{document.error_message}</div>
              ) : null}
            </Link>
            {document.status === "failed" || onDelete ? (
              <div className="mt-3 flex gap-2">
                {document.status === "failed" && onRetry ? (
                  <Button disabled={busyDocumentId === document.id} onClick={() => void onRetry(document.id)}>
                    {busyDocumentId === document.id ? "Retrying..." : "Retry"}
                  </Button>
                ) : null}
                {onDelete ? (
                  <Button
                    className="bg-slate-700 text-white hover:bg-slate-600"
                    disabled={busyDocumentId === document.id}
                    onClick={() => void onDelete(document.id)}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
