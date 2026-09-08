# Job card export DTO — frontend companion

Canonical design (ownership, API, DTO shape):

[`frp/docs/superpowers/specs/2026-09-01-job-card-export-dto-design.md`](../../../../frp/docs/superpowers/specs/2026-09-01-job-card-export-dto-design.md)

(If this path is not available in the Frontend repo alone, use the same filename in the BMS backend repo.)

## Frontend obligations from that design

1. Job card notes UI ↔ `job.notes` only (job update API).
2. Print/export consumes Spring `GET /jobs/{id}/job-card` → `JobCardExportDTO` only.
3. `PUT /jobs/{id}/job-card` sends print leftovers only (no notes/materials).
4. Drop client-side `buildOfficialJobCardData` from the export path once the DTO ships.
