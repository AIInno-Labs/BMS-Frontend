"use client";

import { Copy, FileText } from "lucide-react";
import {
  clonePrintDetailsFromJob,
  ensurePrintDetails,
  findSimilarJobs,
  COLOUR_OPTIONS,
  FINISH_OPTIONS,
  MESH_OPTIONS,
  scopeLinesToText,
  SCOPE_TYPE_OPTIONS,
  THICKNESS_OPTIONS,
  textToScopeLines,
  TRANSPORT_OPTIONS,
  updateClipRow,
} from "@/lib/jobCardFormDefaults";
import type { Job, JobCardPack, JobCardPrintDetails } from "@/lib/types";
import { RaisedBySelect } from "@/components/RaisedBySelect";
import { getAssignableWorkers } from "@/lib/workers";

const fieldClass =
  "mt-1 w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-slate-500";

interface JobCardPrintDetailsFormProps {
  job: Job;
  allJobs: Job[];
  disabled: boolean;
  onChange: (printDetails: JobCardPrintDetails) => void;
}

export function JobCardPrintDetailsForm({
  job,
  allJobs,
  disabled,
  onChange,
}: JobCardPrintDetailsFormProps) {
  const pd = ensurePrintDetails(job);
  const similarJobs = findSimilarJobs(allJobs, job);
  const workers = getAssignableWorkers();

  const patch = (partial: Partial<JobCardPrintDetails>) =>
    onChange({ ...pd, ...partial });

  const handleCopyFrom = (sourceId: string) => {
    const source = allJobs.find((j) => j.id === sourceId);
    if (!source) return;
    onChange(clonePrintDetailsFromJob(source));
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" aria-hidden />
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Official job card (PDF fields)
            </h2>
            <p className="text-sm text-slate-600">
              Matches the client paper form. Empty fields print blank for manual
              shop-floor completion.
            </p>
          </div>
        </div>
      </div>

      {!disabled && similarJobs.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className={labelClass}>Pre-fill from similar job</span>
            <select
              id="similar-job-template"
              defaultValue=""
              className={fieldClass}
              onChange={(e) => {
                if (e.target.value) handleCopyFrom(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">Select a past job for this client…</option>
              {similarJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.id} — {j.projectName.slice(0, 48)}
                  {j.projectName.length > 48 ? "…" : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="flex items-center gap-1 text-xs text-blue-800 sm:max-w-[200px]">
            <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Copies transport, scope, clips &amp; packs. You can override any field
            below.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Raised by" disabled={disabled}>
          <RaisedBySelect
            value={pd.raisedBy ?? ""}
            onChange={(name) => patch({ raisedBy: name })}
            disabled={disabled}
          />
        </Field>

        <Field label="Purchase order no." disabled={disabled}>
          {disabled ? (
            <ReadValue value={pd.purchaseOrderNo} />
          ) : (
            <input
              type="text"
              value={pd.purchaseOrderNo}
              onChange={(e) => patch({ purchaseOrderNo: e.target.value })}
              placeholder="e.g. 248074"
              className={fieldClass}
            />
          )}
        </Field>

        <Field label="Account Y / N" disabled={disabled}>
          {disabled ? (
            <ReadValue value={pd.accountYesNo ? "Yes" : "No"} />
          ) : (
            <select
              value={pd.accountYesNo ? "yes" : "no"}
              onChange={(e) =>
                patch({ accountYesNo: e.target.value === "yes" })
              }
              className={fieldClass}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          )}
        </Field>

        <Field label="Contact phone" disabled={disabled}>
          {disabled ? (
            <ReadValue value={pd.contactPhone} />
          ) : (
            <input
              type="tel"
              value={pd.contactPhone}
              onChange={(e) => patch({ contactPhone: e.target.value })}
              placeholder="Site phone"
              className={fieldClass}
            />
          )}
        </Field>

        <Field label="Contact email" disabled={disabled}>
          {disabled ? (
            <ReadValue value={pd.contactEmail} />
          ) : (
            <input
              type="email"
              value={pd.contactEmail}
              onChange={(e) => patch({ contactEmail: e.target.value })}
              placeholder="site@client.com"
              className={fieldClass}
            />
          )}
        </Field>

        <Field label="Transport" disabled={disabled}>
          {disabled ? (
            <ReadValue value={pd.transport} />
          ) : (
            <>
              <select
                value={
                  TRANSPORT_OPTIONS.includes(
                    pd.transport as (typeof TRANSPORT_OPTIONS)[number]
                  )
                    ? pd.transport
                    : "__custom__"
                }
                onChange={(e) => {
                  if (e.target.value !== "__custom__") {
                    patch({ transport: e.target.value });
                  }
                }}
                className={fieldClass}
              >
                {TRANSPORT_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="__custom__">Other…</option>
              </select>
              <input
                type="text"
                value={pd.transport}
                onChange={(e) => patch({ transport: e.target.value })}
                placeholder="Transport arrangement"
                className={`${fieldClass} mt-2`}
              />
            </>
          )}
        </Field>

        <Field label="Transport company" disabled={disabled}>
          {disabled ? (
            <ReadValue value={pd.transportCompany} />
          ) : (
            <input
              type="text"
              value={pd.transportCompany}
              onChange={(e) => patch({ transportCompany: e.target.value })}
              placeholder="Carrier name"
              className={fieldClass}
            />
          )}
        </Field>

        <Field label="Freight account #" disabled={disabled}>
          {disabled ? (
            <ReadValue value={pd.freightAccount} />
          ) : (
            <input
              type="text"
              value={pd.freightAccount}
              onChange={(e) => patch({ freightAccount: e.target.value })}
              placeholder="Account number"
              className={fieldClass}
            />
          )}
        </Field>

        <Field label="Consignment note #" disabled={disabled}>
          {disabled ? (
            <ReadValue value={pd.consignmentNote} />
          ) : (
            <input
              type="text"
              value={pd.consignmentNote}
              onChange={(e) => patch({ consignmentNote: e.target.value })}
              placeholder="Consignment ref."
              className={fieldClass}
            />
          )}
        </Field>

        <Field label="Despatch date" disabled={disabled}>
          {disabled ? (
            <ReadValue value={pd.despatchDate} />
          ) : (
            <input
              type="date"
              value={pd.despatchDate}
              onChange={(e) => patch({ despatchDate: e.target.value })}
              className={fieldClass}
            />
          )}
        </Field>

        <Field label="Delivery docket #" disabled={disabled}>
          {disabled ? (
            <ReadValue value={pd.deliveryDocket} />
          ) : (
            <input
              type="text"
              value={pd.deliveryDocket}
              onChange={(e) => patch({ deliveryDocket: e.target.value })}
              placeholder="Docket number"
              className={fieldClass}
            />
          )}
        </Field>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className={labelClass}>Scope of work (prints on official card)</p>
        {disabled ? (
          <ul className="mt-2 list-inside list-disc text-sm text-slate-800">
            {pd.scopeLines?.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          <textarea
            value={scopeLinesToText(pd.scopeLines)}
            onChange={(e) =>
              patch({ scopeLines: textToScopeLines(e.target.value) })
            }
            rows={4}
            placeholder="One line per scope item, e.g.&#10;FRP Ladder as per drawing C59807&#10;Module 1, 2 and 3 — 1 off each"
            className={`${fieldClass} mt-1 font-mono text-sm`}
          />
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SpecField
          label="Type"
          value={pd.scopeType ?? ""}
          disabled={disabled}
          options={SCOPE_TYPE_OPTIONS}
          onChange={(v) => patch({ scopeType: v })}
        />
        <SpecField
          label="Thickness (mm)"
          value={pd.thickness ?? ""}
          disabled={disabled}
          options={THICKNESS_OPTIONS}
          onChange={(v) => patch({ thickness: v })}
        />
        <SpecField
          label="Mesh"
          value={pd.mesh ?? ""}
          disabled={disabled}
          options={MESH_OPTIONS}
          onChange={(v) => patch({ mesh: v })}
        />
        <SpecField
          label="Colour"
          value={pd.colour ?? ""}
          disabled={disabled}
          options={COLOUR_OPTIONS}
          onChange={(v) => patch({ colour: v })}
        />
        <SpecField
          label="Finish"
          value={pd.finish ?? ""}
          disabled={disabled}
          options={FINISH_OPTIONS}
          onChange={(v) => patch({ finish: v })}
        />
        <div>
          <p className={labelClass}>Resin (from job)</p>
          <p className="mt-1 text-sm font-medium text-slate-700">{job.resinType}</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <p className={labelClass}>Clips — QTY &amp; packed by</p>
        <table className="mt-2 w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold">
                Clip type
              </th>
              <th className="border border-slate-200 px-2 py-1.5 text-left w-24">
                QTY
              </th>
              <th className="border border-slate-200 px-2 py-1.5 text-left w-32">
                Packed by
              </th>
            </tr>
          </thead>
          <tbody>
            {pd.clipRows?.map((row, index) => (
              <tr key={`clip-row-${index}`}>
                <td className="border border-slate-200 px-2 py-1 text-slate-800">
                  {row.clip}
                </td>
                <td className="border border-slate-200 px-1 py-1">
                  {disabled ? (
                    <span className="px-1">{row.qty || "—"}</span>
                  ) : (
                    <input
                      type="text"
                      value={row.qty}
                      onChange={(e) =>
                        patch({
                          clipRows: updateClipRow(
                            pd.clipRows!,
                            index,
                            { qty: e.target.value }
                          ),
                        })
                      }
                      placeholder="—"
                      className="w-full rounded border border-slate-200 px-2 py-1"
                    />
                  )}
                </td>
                <td className="border border-slate-200 px-1 py-1">
                  {disabled ? (
                    <span className="px-1">{row.packedBy || "—"}</span>
                  ) : (
                    <input
                      type="text"
                      value={row.packedBy}
                      onChange={(e) =>
                        patch({
                          clipRows: updateClipRow(
                            pd.clipRows!,
                            index,
                            { packedBy: e.target.value }
                          ),
                        })
                      }
                      placeholder="Initials"
                      className="w-full rounded border border-slate-200 px-2 py-1"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <p className={labelClass}>Pack dimensions (transport)</p>
        <div className="mt-2 grid gap-3 lg:grid-cols-3">
          {[0, 1, 2].map((packIndex) => (
            <div
              key={packIndex}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <p className="text-sm font-semibold text-slate-800">
                Pack {packIndex + 1}
              </p>
              {(["length", "width", "height", "weightKg"] as const).map(
                (key) => (
                  <label key={key} className="mt-2 block">
                    <span className="text-xs text-slate-500">
                      {key === "weightKg"
                        ? "Weight (kg)"
                        : key.charAt(0).toUpperCase() + key.slice(1)}
                    </span>
                    {disabled ? (
                      <ReadValue
                        value={pd.packs?.[packIndex]?.[key]}
                        className="mt-0.5"
                      />
                    ) : (
                      <input
                        type="text"
                        value={pd.packs?.[packIndex]?.[key] ?? ""}
                        onChange={(e) => {
                          const packs: [JobCardPack, JobCardPack, JobCardPack] =
                            [
                              { ...pd.packs![0] },
                              { ...pd.packs![1] },
                              { ...pd.packs![2] },
                            ];
                          packs[packIndex][key] = e.target.value;
                          patch({ packs });
                        }}
                        placeholder="—"
                        className={fieldClass}
                      />
                    )}
                  </label>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className={labelClass}>Delivery instructions</p>
        {disabled ? (
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
            {pd.deliveryInstructions || "—"}
          </p>
        ) : (
          <textarea
            value={pd.deliveryInstructions}
            onChange={(e) => patch({ deliveryInstructions: e.target.value })}
            rows={3}
            placeholder="Site delivery notes, access, crane lift, etc."
            className={`${fieldClass} mt-1`}
          />
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Photo checklist, bolt list &amp; workshop tables on page 2 of the PDF
        remain blank for manual completion on the shop floor (same as paper
        card).
      </p>
    </section>
  );
}

function Field({
  label,
  children,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  disabled: boolean;
}) {
  return (
    <label className={disabled ? "opacity-90" : undefined}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function ReadValue({
  value,
  className = "",
}: {
  value?: string;
  className?: string;
}) {
  return (
    <p
      className={`mt-1 text-sm font-medium ${value ? "text-slate-900" : "text-slate-400 italic"} ${className}`}
    >
      {value || "Blank on PDF — edit to fill"}
    </p>
  );
}

function SpecField({
  label,
  value,
  disabled,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  options?: readonly string[];
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      {disabled ? (
        <ReadValue value={value} />
      ) : options ? (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
        >
          {options.map((o) => (
            <option key={o || "empty"} value={o}>
              {o || "— Select —"}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={fieldClass}
        />
      )}
    </div>
  );
}
