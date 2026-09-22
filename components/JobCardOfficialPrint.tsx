"use client";

import { useEffect, useState } from "react";
import {
  buildOfficialJobCardData,
  formatJobCardIdVersionFooter,
  PHOTO_CHECKLIST_ROWS,
  SCOPE_CHECKLIST_ITEMS,
} from "@/lib/jobCardPrint";
import type { OfficialJobCardData } from "@/lib/jobCardPrint";
import { getJobAuditCount } from "@/lib/frp/job-audit";
import type { Job } from "@/lib/types";

const FRP_LOGO_LOCKUP_SRC = "/frp-logo-lockup-trimmed.png";

function FrpLogo() {
  return (
    <div className="official-jc-logo">
      <img
        src={FRP_LOGO_LOCKUP_SRC}
        alt="FRP Engineering"
        width={573}
        height={258}
        className="official-jc-logo-img"
      />
    </div>
  );
}

function LabelValue({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <tr>
      <th className="official-jc-lv-label">{label}</th>
      <td className={`official-jc-lv-value ${valueClassName}`}>{value || "\u00a0"}</td>
    </tr>
  );
}

function SectionBar({ children }: { children: React.ReactNode }) {
  return <div className="official-jc-section-bar">{children}</div>;
}

function OfficialPage1({ data }: { data: OfficialJobCardData }) {
  return (
    <section className="official-jc-page official-jc-page--1" aria-label="Job card page 1">
      <div className="official-jc-page-inner">
      <table className="official-jc-header-table">
        <tbody>
          <tr>
            <td rowSpan={2} className="official-jc-spine">
              JOB CARD
            </td>
            <td colSpan={3} className="official-jc-top-band">
              <table className="official-jc-top-row">
                <tbody>
                  <tr>
                    <th>Job #</th>
                    <td className="official-jc-bold">{data.jobNumber}</td>
                    <th>Date</th>
                    <td>{data.date}</td>
                    <th>Due Date</th>
                    <td className="official-jc-due">{data.dueDate}</td>
                    <th>Raised by</th>
                    <td>{data.raisedBy}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td className="official-jc-block" valign="top">
              <table className="official-jc-inner">
                <tbody>
                  <LabelValue label="Customer" value={data.customer} />
                  <LabelValue label="Contact Name" value={data.contactName} />
                  <LabelValue label="Contact Number" value={data.contactPhone} />
                  <LabelValue label="Contact Email" value={data.contactEmail} />
                  <LabelValue
                    label="Purchase Order No."
                    value={data.purchaseOrderNo}
                  />
                  <LabelValue label="Account Y / N" value={data.accountYesNo} />
                </tbody>
              </table>
            </td>
            <td className="official-jc-block" valign="top">
              <table className="official-jc-inner">
                <tbody>
                  <LabelValue label="Transport" value={data.transport} />
                  <LabelValue
                    label="Transport Company"
                    value={data.transportCompany}
                  />
                  <LabelValue label="Account #" value={data.freightAccount} />
                  <LabelValue
                    label="Consignment Note #"
                    value={data.consignmentNote}
                  />
                  <LabelValue label="Despatch Date" value={data.despatchDate} />
                  <LabelValue
                    label="Delivery Docket #"
                    value={data.deliveryDocket}
                  />
                </tbody>
              </table>
            </td>
            <td className="official-jc-block official-jc-logo-cell" valign="top">
              <FrpLogo />
              <table className="official-jc-qa-table">
                <thead>
                  <tr>
                    <th colSpan={3} className="official-jc-qa-head">
                      QA SIGN OFF
                    </th>
                  </tr>
                  <tr>
                    <th>Name</th>
                    <th>Sign</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{data.qaCompleted ? data.assignedWorker : ""}</td>
                    <td />
                    <td />
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <p className="official-jc-doubt">IF IN DOUBT - ASK</p>
      <p className="official-jc-qa-note">
        QA CAN NOT BE SIGNED OFF UNTIL JOB CARD HAS BEEN MARKED WITH WHO AND
        WHEN ITEMS WERE PACKED AND PHOTO EVIDENCE IS IN JOB FILE
      </p>

      <SectionBar>SCOPE OF WORK</SectionBar>
      <table className="official-jc-scope-table">
        <tbody>
          <tr>
            <td className="official-jc-scope-text" valign="top">
              {data.scopeLines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              <p className="official-jc-scope-flags">
                Mfg required: {data.manufacturingRequired ? "Yes" : "No"} ·
                Install: {data.installRequired ? "Yes" : "No"} · Status:{" "}
                {data.status}
                {data.estimatedHours ? ` · Est. ${data.estimatedHours}` : ""}
              </p>
            </td>
            <td className="official-jc-spec-col" valign="top">
              <table className="official-jc-spec-table">
                <tbody>
                  {(
                    [
                      ["Type", data.scopeType],
                      ["Thickness", data.thickness],
                      ["Mesh", data.mesh],
                      ["Resin", data.resin],
                      ["Colour", data.colour],
                      ["Finish", data.finish],
                    ] as const
                  ).map(([label, val]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      <td>{val || "\u00a0"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="official-jc-clips-table">
                <thead>
                  <tr>
                    <th>CLIPS</th>
                    <th>QTY</th>
                    <th>Packed by</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clipRows.map((row, index) => (
                    <tr key={`clip-row-${index}`}>
                      <td>{row.clip}</td>
                      <td>{row.qty}</td>
                      <td>{row.packedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <SectionBar>Photographs and Job check list</SectionBar>
      <table className="official-jc-photo-table">
        <tbody>
          <tr>
            <td valign="top" className="official-jc-photo-left">
              <table>
                <thead>
                  <tr>
                    <th>Job Photos</th>
                    <th>Initial</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {PHOTO_CHECKLIST_ROWS.map((row) => (
                    <tr key={row}>
                      <td>{row}</td>
                      <td />
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
            <td valign="top" className="official-jc-photo-right">
              <table>
                <thead>
                  <tr>
                    <th>Bolt List / Size</th>
                    <th>QTY</th>
                    <th>Date</th>
                    <th>Initial</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td />
                      <td />
                      <td />
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <SectionBar>NOTES</SectionBar>
      <div className="official-jc-notes-box">
        <p className="whitespace-pre-wrap">{data.notes || "\u00a0"}</p>
      </div>

      <div className="official-jc-page-fill">
      <SectionBar>Pack Dimensions &amp; Delivery instructions</SectionBar>
      <table className="official-jc-pack-table official-jc-pack-table--grow">
        <tbody>
          <tr className="official-jc-pack-row">
            <td valign="top" className="official-jc-pack-left">
              <p className="official-jc-pack-title">
                PACK DIMENSIONS FOR TRANSPORT
              </p>
              <table className="official-jc-pack-grid">
                <thead>
                  <tr>
                    <th />
                    <th>PACK 1:</th>
                    <th>PACK 2:</th>
                    <th>PACK 3:</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["LENGTH -", "length"],
                      ["WIDTH -", "width"],
                      ["HEIGHT -", "height"],
                      ["WEIGHT (KG) -", "weightKg"],
                    ] as const
                  ).map(([label, key]) => (
                    <tr key={key}>
                      <th>{label}</th>
                      <td>{data.packs[0][key]}</td>
                      <td>{data.packs[1][key]}</td>
                      <td>{data.packs[2][key]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
            <td valign="top" className="official-jc-pack-right">
              <p className="official-jc-delivery-label">Delivery instructions</p>
              <div className="official-jc-delivery-box">
                <p className="whitespace-pre-wrap">
                  {data.deliveryInstructions || "\u00a0"}
                </p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
      </div>

      <footer className="official-jc-footer official-jc-footer--pinned">
        <span className="official-jc-footer-left">
          {formatJobCardIdVersionFooter(data.jobNumber, data.jobCardVersion)}
        </span>
        <span className="official-jc-footer-page">Page 1</span>
      </footer>
    </section>
  );
}

function OfficialPage2({ data }: { data: OfficialJobCardData }) {
  const despatchCols = 3;

  return (
    <section
      className="official-jc-page official-jc-page--2"
      aria-label="Job card page 2 workshop schedule"
    >
      <div className="official-jc-page-inner">
      <table className="official-jc-p2-header official-jc-header-table">
        <tbody>
          <tr>
            <th className="official-jc-spine official-jc-p2-title" rowSpan={7}>
              JOB CARD
            </th>
            <th>Job #</th>
            <td>{data.jobNumber}</td>
            <th>Date</th>
            <td>{data.date}</td>
            <th>Due Date</th>
            <td className="official-jc-due">{data.dueDate}</td>
            <th>Raised by</th>
            <td>{data.raisedBy}</td>
          </tr>
          <tr>
            <th>Customer</th>
            <td colSpan={3}>{data.customer}</td>
            <th>Transport</th>
            <td colSpan={3}>{data.transport}</td>
          </tr>
          <tr>
            <th>Contact Name</th>
            <td colSpan={3}>{data.contactName}</td>
            <th>Transport Company</th>
            <td colSpan={3}>{data.transportCompany}</td>
          </tr>
          <tr>
            <th>Contact Number</th>
            <td colSpan={3}>{data.contactPhone}</td>
            <th>Freight Account #</th>
            <td colSpan={3}>{data.freightAccount}</td>
          </tr>
          <tr>
            <th>Contact Email</th>
            <td colSpan={3}>{data.contactEmail}</td>
            <th>Consignment Note #</th>
            <td colSpan={3}>{data.consignmentNote}</td>
          </tr>
          <tr>
            <th>Purchase Order No.</th>
            <td colSpan={3}>{data.purchaseOrderNo}</td>
            <th>Despatch Date</th>
            <td colSpan={3}>{data.despatchDate}</td>
          </tr>
          <tr>
            <th>Account Y / N</th>
            <td colSpan={3}>{data.accountYesNo}</td>
            <th>Delivery Docket #</th>
            <td colSpan={3}>{data.deliveryDocket}</td>
          </tr>
        </tbody>
      </table>

      <div className="official-jc-p2-scope-head">
        <span className="official-jc-p2-scope-title">SCOPE OF WORK</span>
        <span className="official-jc-doubt official-jc-doubt--inline">
          IF IN DOUBT - ASK
        </span>
      </div>
      <div className="official-jc-p2-scope-box">
        {data.scopeLines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      <div className="official-jc-p2-checklist">
        {SCOPE_CHECKLIST_ITEMS.map((item) => (
          <label key={item} className="official-jc-check-item">
            <span className="official-jc-checkbox" />
            {item}
          </label>
        ))}
      </div>

      <WorkshopTable
        title="Grating / Treads"
        columns={[
          "Construction",
          "Grating / Tread",
          "Mesh",
          "Thickness",
          "Resin",
          "Finish",
          "Colour",
          "Nosing",
        ]}
        rowCount={2}
        despatchCols={despatchCols}
        fillRow={[
          "",
          data.scopeType,
          data.mesh,
          data.thickness,
          data.resin,
          data.finish,
          data.colour,
          "",
        ]}
      />

      <WorkshopTable
        title="Clips"
        columns={[
          "Qty",
          "Top plate",
          "Fixing",
          "Type",
          "Bottom Bracket",
          "Washer",
          "Nut",
          "Material",
        ]}
        rowCount={2}
        despatchCols={despatchCols}
        note="Note: M25 & M38 assemblies sold in boxes of 10. Box contents = 10 @ top plates, 10 @ M8x40 hex head bolt and 10 @ flat washers (316 s/s)"
      />

      <WorkshopTable
        title="Fasteners (not clip assemblies)"
        columns={["Qty", "Type", "Size", "Material"]}
        rowCount={2}
        despatchCols={despatchCols}
      />

      <div className="official-jc-page-fill">
      <SectionBar>Pack Dimensions &amp; Delivery Instructions</SectionBar>
      <table className="official-jc-p2-pack official-jc-pack-table--grow">
        <tbody>
          <tr>
            <td className="official-jc-p2-delivery" valign="top">
              <div className="official-jc-p2-delivery-inner">
                <p>{data.deliveryInstructions || "\u00a0"}</p>
              </div>
            </td>
            <td valign="top">
              <table className="official-jc-p2-pack-grid">
                <thead>
                  <tr>
                    <th />
                    <th>Length</th>
                    <th>Width</th>
                    <th>Height</th>
                    <th>Weight</th>
                    <th colSpan={2}>Despatch Photos</th>
                  </tr>
                  <tr>
                    <th />
                    <th />
                    <th />
                    <th />
                    <th />
                    <th>Yes / No</th>
                    <th>Initials / Date</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3].map((n, idx) => (
                    <tr key={n}>
                      <th>{n}</th>
                      <td>{data.packs[idx].length}</td>
                      <td>{data.packs[idx].width}</td>
                      <td>{data.packs[idx].height}</td>
                      <td>{data.packs[idx].weightKg}</td>
                      <td className="official-jc-despatch-yes" />
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
      </div>

      <footer className="official-jc-footer official-jc-footer--pinned">
        <span className="official-jc-footer-left">
          {formatJobCardIdVersionFooter(data.jobNumber, data.jobCardVersion)}
        </span>
        <span className="official-jc-footer-center">Workshop Schedule_Inventory- NEW</span>
        <span className="official-jc-footer-page">Page 2</span>
      </footer>
    </section>
  );
}

function WorkshopTable({
  title,
  columns,
  rowCount,
  despatchCols,
  fillRow,
  note,
}: {
  title: string;
  columns: string[];
  rowCount: number;
  despatchCols: number;
  fillRow?: string[];
  note?: string;
}) {
  return (
    <div className="official-jc-workshop-block">
      <table className="official-jc-workshop-table">
        <thead>
          <tr>
            <th className="official-jc-workshop-title" colSpan={columns.length + 3}>
              {title}
            </th>
          </tr>
          <tr>
            <th className="official-jc-row-num" />
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
            <th colSpan={2}>Despatch Photos</th>
          </tr>
          <tr>
            <th />
            {columns.map((c) => (
              <th key={`${c}-sub`} className="official-jc-subhead" />
            ))}
            <th className="official-jc-subhead">Yes / No</th>
            <th className="official-jc-subhead">Initials / Date</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, i) => (
            <tr key={i}>
              <th className="official-jc-row-num">{i + 1}</th>
              {columns.map((c, ci) => (
                <td key={c}>
                  {fillRow && i === 0 ? fillRow[ci] || "\u00a0" : "\u00a0"}
                </td>
              ))}
              <td className="official-jc-despatch-yes" />
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="official-jc-workshop-note">{note}</p>}
    </div>
  );
}

export function JobCardOfficialPrint({
  job,
  className = "",
}: {
  job: Job;
  className?: string;
}) {
  const [auditCount, setAuditCount] = useState(0);

  useEffect(() => {
    const dbId = job.dbId;
    if (!dbId) return;
    let cancelled = false;
    void getJobAuditCount(dbId).then((count) => {
      if (!cancelled) setAuditCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [job.dbId]);

  const data = buildOfficialJobCardData(job, undefined, auditCount);

  return (
    <div className={`official-jc-root ${className}`.trim()}>
      <OfficialPage1 data={data} />
      <OfficialPage2 data={data} />
    </div>
  );
}
