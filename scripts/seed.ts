/**
 * Industrial seed — 100% fictional data (Faker).
 * Requires supabase/schema.sql applied + .env.local service role key.
 * npm run db:seed
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { faker } from "@faker-js/faker";

faker.seed(20260525);

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing Supabase URL/key in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CLIENTS = [
  "Pacific Mining Logistics",
  "Apex Infrastructure Contractors",
  "Northern Pilbara Fabricators",
  "Coastal Chemical Processing",
  "Metro Wastewater Alliance",
  "Southern Rail Maintenance Co",
  "Harbour Marine Services",
  "Desert Solar Operations",
  "BlueScope Fabrication Partners",
  "Regional Water Treatment JV",
];

const FABRICATORS = [
  {
    id: "fab-mitchell",
    name: "J. Mitchell",
    initials: "JM",
    present: true,
    certifications: ["IsoFR", "Vinyl Ester"],
  },
  {
    id: "fab-patterson",
    name: "S. Patterson",
    initials: "SP",
    present: false,
    certifications: ["IsoFR"],
  },
  {
    id: "fab-nguyen",
    name: "K. Nguyen",
    initials: "KN",
    present: true,
    certifications: ["IsoFR", "Phenolic"],
  },
  {
    id: "fab-brooks",
    name: "L. Brooks",
    initials: "LB",
    present: true,
    certifications: ["IsoFR"],
  },
  {
    id: "fab-henderson",
    name: "M. Henderson",
    initials: "MH",
    present: true,
    certifications: ["IsoFR", "Vinyl Ester"],
  },
  {
    id: "fab-williams",
    name: "T. Williams",
    initials: "TW",
    present: true,
    certifications: ["IsoFR"],
  },
  {
    id: "fab-rivera",
    name: "A. Rivera",
    initials: "AR",
    present: true,
    certifications: ["Vinyl Ester", "Phenolic"],
  },
] as const;

const FLOOR_ASSIGN_STATUSES = new Set([
  "In Fabrication",
  "Ready to Manufacture",
  "On Hold",
]);

const STATUSES = [
  "Pending",
  "Awaiting Manager Approval",
  "Ready to Manufacture",
  "In Fabrication",
  "On Hold",
  "Complete",
] as const;

const INVENTORY = [
  {
    sku_code: "GR-M-38-GRN-ISO",
    product_group: "Grating - Moulded",
    description_1: "38mm thick 38 square mesh",
    description_2: "1220x3660 sheet",
    description_3: "IsoFR Green",
    description_4: "Moulded panel",
    resin_material: "OFR",
    primary_colour: "Green",
    stock_quantity: 42,
    reorder_level: 10,
  },
  {
    sku_code: "GR-M-25-YLW-ISO",
    product_group: "Grating - Moulded",
    description_1: "25mm thick 38 square mesh",
    description_2: "Safety yellow",
    description_3: "1220x2440",
    description_4: "",
    resin_material: "OFR",
    primary_colour: "Yellow",
    stock_quantity: 28,
    reorder_level: 8,
  },
  {
    sku_code: "GR-M-38-CHR-VE",
    product_group: "Grating - Moulded",
    description_1: "38mm thick VEFR Charcoal",
    description_2: "38x38 mesh",
    description_3: "Chemical duty",
    description_4: "",
    resin_material: "VEFR",
    primary_colour: "Charcoal",
    stock_quantity: 6,
    reorder_level: 12,
  },
  {
    sku_code: "GR-P-50-GRY",
    product_group: "Grating - Pultruded",
    description_1: "50mm pultruded grating",
    description_2: "Grey IsoFR",
    description_3: "I-beam bar",
    description_4: "",
    resin_material: "OFR",
    primary_colour: "Dark Grey",
    stock_quantity: 18,
    reorder_level: 6,
  },
  {
    sku_code: "RES-VE-BULK",
    product_group: "Raw Materials",
    description_1: "Vinyl Ester Resin",
    description_2: "VEFR system",
    description_3: "200L drum",
    description_4: "",
    resin_material: "VEFR",
    primary_colour: null,
    stock_quantity: 840,
    reorder_level: 200,
  },
  {
    sku_code: "RES-ISO-BULK",
    product_group: "Raw Materials",
    description_1: "Isophthalic Polyester Resin",
    description_2: "IsoFR system",
    description_3: "200L drum",
    description_4: "",
    resin_material: "OFR",
    primary_colour: null,
    stock_quantity: 1200,
    reorder_level: 300,
  },
  {
    sku_code: "CAT-MEKP",
    product_group: "Consumables",
    description_1: "Catalyst MEKP",
    description_2: "20L pail",
    description_3: "",
    description_4: "",
    resin_material: "N/A",
    primary_colour: null,
    stock_quantity: 95,
    reorder_level: 25,
  },
  {
    sku_code: "TRD-M-38-GRIT",
    product_group: "Grating - Moulded",
    description_1: "Moulded stair tread 38mm",
    description_2: "Yellow grit nosing",
    description_3: "1200mm wide",
    description_4: "",
    resin_material: "OFR",
    primary_colour: "Green",
    stock_quantity: 55,
    reorder_level: 15,
  },
  {
    sku_code: "CLIP-M38-BOX",
    product_group: "Clips & Fasteners",
    description_1: "Box 38mm M clips",
    description_2: "10 per box",
    description_3: "316 hardware",
    description_4: "",
    resin_material: "N/A",
    primary_colour: null,
    stock_quantity: 98,
    reorder_level: 30,
  },
  {
    sku_code: "PUL-C-100",
    product_group: "Structural Profiles",
    description_1: "Pultruded C-Channel 100mm",
    description_2: "6m length",
    description_3: "Grey IsoFR",
    description_4: "",
    resin_material: "OFR",
    primary_colour: "Light Grey",
    stock_quantity: 180,
    reorder_level: 40,
  },
  {
    sku_code: "MESH-15-VE",
    product_group: "Grating - Moulded",
    description_1: "15mm mini-mesh grating",
    description_2: "38mm thick VEFR",
    description_3: "Charcoal",
    description_4: "",
    resin_material: "VEFR",
    primary_colour: "Charcoal",
    stock_quantity: 14,
    reorder_level: 8,
  },
  {
    sku_code: "ROV-CSM-450",
    product_group: "Raw Materials",
    description_1: "Chopped Strand Mat 450g",
    description_2: "30m roll",
    description_3: "",
    description_4: "",
    resin_material: "N/A",
    primary_colour: null,
    stock_quantity: 36,
    reorder_level: 12,
  },
  {
    sku_code: "HR-ASSY-STD",
    product_group: "Structural Profiles",
    description_1: "FRP handrail stanchion kit",
    description_2: "VEFR standard",
    description_3: "1.1m height",
    description_4: "",
    resin_material: "VEFR",
    primary_colour: "Grey",
    stock_quantity: 64,
    reorder_level: 20,
  },
  {
    sku_code: "PIG-CHARCOAL",
    product_group: "Raw Materials",
    description_1: "Charcoal pigment paste",
    description_2: "5kg tub",
    description_3: "",
    description_4: "",
    resin_material: "N/A",
    primary_colour: "Charcoal",
    stock_quantity: 32,
    reorder_level: 10,
  },
  {
    sku_code: "GR-M-38-BLU",
    product_group: "Grating - Moulded",
    description_1: "38mm moulded grating Blue",
    description_2: "38x38 mesh",
    description_3: "IsoFR",
    description_4: "",
    resin_material: "OFR",
    primary_colour: "Blue",
    stock_quantity: 22,
    reorder_level: 8,
  },
  {
    sku_code: "ACC-COBALT",
    product_group: "Consumables",
    description_1: "Cobalt accelerator 6%",
    description_2: "1L bottle",
    description_3: "",
    description_4: "",
    resin_material: "N/A",
    primary_colour: null,
    stock_quantity: 24,
    reorder_level: 8,
  },
  {
    sku_code: "GR-M-32-CONC",
    product_group: "Grating - Moulded",
    description_1: "32mm moulded grating",
    description_2: "Concrete colour",
    description_3: "38/19 sq mesh",
    description_4: "",
    resin_material: "OFR",
    primary_colour: "Concrete",
    stock_quantity: 31,
    reorder_level: 10,
  },
  {
    sku_code: "CLIP-M25-BOX",
    product_group: "Clips & Fasteners",
    description_1: "Box 25mm M clips",
    description_2: "10 assemblies",
    description_3: "",
    description_4: "",
    resin_material: "N/A",
    primary_colour: null,
    stock_quantity: 140,
    reorder_level: 40,
  },
  {
    sku_code: "RES-PHEN",
    product_group: "Raw Materials",
    description_1: "Phenolic resin system",
    description_2: "Fire retardant",
    description_3: "200L drum",
    description_4: "",
    resin_material: "Phen",
    primary_colour: null,
    stock_quantity: 120,
    reorder_level: 40,
  },
];

const SPECS = {
  construction: ["Moulded", "Pultruded", "Other"] as const,
  category: ["Grating", "Tread", "Other"] as const,
  mesh: ["38x38", "50x50", "38/19 sq", "40/20 sq"] as const,
  thickness: ["25", "32", "38", "50"] as const,
  resin: ["OFR", "VEFR", "VE", "Phen"] as const,
  finish: ["Grit #1", "Grit #3", "Grit #5", "Sand"] as const,
  colour: ["Green", "Yellow", "Charcoal", "Light Grey", "Dark Grey", "Blue"] as const,
  nosing: ["Yellow", "Black"] as const,
};

async function seedStaff() {
  for (const fab of FABRICATORS) {
    const { error } = await supabase.from("staff").upsert(
      {
        id: fab.id,
        display_name: fab.name,
        initials: fab.initials,
        certifications: fab.certifications,
        shift_hours_capacity: 8,
        is_present: fab.present,
      },
      { onConflict: "id" }
    );
    if (error) throw new Error(`staff ${fab.id}: ${error.message}`);
  }
  console.log(`✓ ${FABRICATORS.length} fabricators on roster`);
}

async function seedInventory() {
  for (const row of INVENTORY) {
    const { error } = await supabase
      .from("inventory")
      .upsert(row as Record<string, unknown>, { onConflict: "sku_code" });
    if (error) throw new Error(`inventory ${row.sku_code}: ${error.message}`);
  }
  console.log(`✓ ${INVENTORY.length} inventory SKUs`);
}

async function clearJobsRange() {
  const ids = Array.from({ length: 100 }, (_, i) => `JOB-${1001 + i}`);
  const { data: jobs } = await supabase.from("jobs").select("id").in("id", ids);
  const found = (jobs ?? []).map((j) => j.id);
  if (!found.length) return;
  await supabase.from("job_materials").delete().in("job_id", found);
  await supabase.from("job_labor").delete().in("job_id", found);
  await supabase.from("jobs").delete().in("id", found);
}

function buildJobRow(seq: number, floorSlot: number) {
  const id = `JOB-${seq}`;
  const jobDate = faker.date.between({ from: "2025-10-01", to: "2026-05-18" });
  const due = new Date(jobDate);
  due.setDate(due.getDate() + faker.number.int({ min: 7, max: 35 }));
  const status = faker.helpers.weightedArrayElement([
    { weight: 28, value: "Complete" as const },
    { weight: 18, value: "Pending" as const },
    { weight: 12, value: "Awaiting Manager Approval" as const },
    { weight: 16, value: "Ready to Manufacture" as const },
    { weight: 14, value: "In Fabrication" as const },
    { weight: 12, value: "On Hold" as const },
  ]);
  const present = FABRICATORS.filter((f) => f.present);

  let assigned_worker_name: string | null = null;
  if (FLOOR_ASSIGN_STATUSES.has(status)) {
    if (seq % 13 === 0) {
      assigned_worker_name = "S. Patterson";
    } else {
      assigned_worker_name = present[floorSlot % present.length].name;
    }
  }

  const onFloor = FLOOR_ASSIGN_STATUSES.has(status);

  return {
    id,
    workflow_status: status,
    priority: faker.helpers.weightedArrayElement([
      { weight: 70, value: "Normal" },
      { weight: 22, value: "High" },
      { weight: 8, value: "RUSH" },
    ]),
    date_raised: jobDate.toISOString().slice(0, 10),
    due_date: due.toISOString().slice(0, 10),
    raised_by: faker.helpers.arrayElement(FABRICATORS.map((f) => f.name)),
    assigned_worker_name,
    customer_name: faker.helpers.arrayElement(CLIENTS),
    project_name: faker.helpers.arrayElement([
      "Custom FRP walkway platform — 38x38 VEFR Charcoal",
      "Moulded grating cut-to-size — 25mm yellow IsoFR",
      "FRP handrail assembly — tread and midrail",
      "Chemical bund grating — 38mm VEFR",
      "Pump pad surround — green moulded panels",
    ]),
    transport_company: faker.helpers.arrayElement(["StarTrack Express", "TNT Freight", "Customer fleet"]),
    freight_account_number: faker.helpers.arrayElement(["Y-88421", "Y-12093", "Prepaid", ""]),
    consignment_note_number: chance(0.4) ? `CN-${faker.string.numeric(9)}` : null,
    despatch_date: null,
    delivery_docket_number: null,
    delivery_instructions: faker.helpers.arrayElement([
      "Forklift unload — steel stillage required",
      "Call supervisor 30 min prior to delivery",
      "",
    ]),
    pack_dimensions: JSON.stringify([
      { length: "2400", width: "1200", height: "450", weightKg: "120" },
      { length: "", width: "", height: "", weightKg: "" },
      { length: "", width: "", height: "", weightKg: "" },
    ]),
    construction_type: faker.helpers.arrayElement(SPECS.construction),
    product_category: faker.helpers.arrayElement(SPECS.category),
    mesh_size: faker.helpers.arrayElement(SPECS.mesh),
    thickness_mm: faker.helpers.arrayElement(SPECS.thickness),
    resin_type: faker.helpers.arrayElement(SPECS.resin),
    finish_type: faker.helpers.arrayElement(SPECS.finish),
    colour: faker.helpers.arrayElement(SPECS.colour),
    nosing_colour: chance(0.7)
      ? faker.helpers.arrayElement([...SPECS.nosing])
      : null,
    estimated_hours: onFloor
      ? faker.number.float({ min: 2.5, max: 7.5, fractionDigits: 1 })
      : faker.number.float({ min: 8, max: 40, fractionDigits: 1 }),
    alert_message: chance(0.12)
      ? faker.helpers.arrayElement(["RUSH — fixed dock date", "Awaiting client drawings"])
      : null,
  };
}

function chance(p: number) {
  return faker.number.float({ min: 0, max: 1 }) < p;
}

async function seedJobs() {
  await clearJobsRange();

  let floorSlot = 0;
  for (let batch = 0; batch < 10; batch++) {
    const rows = Array.from({ length: 10 }, (_, i) => {
      const seq = 1001 + batch * 10 + i;
      const row = buildJobRow(seq, floorSlot);
      if (row.assigned_worker_name && FLOOR_ASSIGN_STATUSES.has(row.workflow_status)) {
        floorSlot += 1;
      }
      return row;
    });
    const { data: inserted, error } = await supabase.from("jobs").insert(rows).select("id");
    if (error) throw new Error(`jobs batch: ${error.message}`);

    for (const job of inserted ?? []) {
      const matCount = faker.number.int({ min: 2, max: 4 });
      const materials = Array.from({ length: matCount }, (_, idx) => ({
        job_id: job.id,
        sl_no: idx + 1,
        section: idx === 0 ? "Grating_Treads" : "Raw_Material",
        item_description: faker.commerce.productName(),
        qty: faker.number.int({ min: 1, max: 24 }),
        unit: "ea",
        unit_price: faker.number.float({ min: 40, max: 800, fractionDigits: 2 }),
      }));
      const laborCount = faker.number.int({ min: 1, max: 3 });
      const labor = Array.from({ length: laborCount }, (_, idx) => ({
        job_id: job.id,
        sl_no: idx + 1,
        labor_category: faker.helpers.arrayElement(["Lay-up", "Trim & Finish", "QA Inspection"]),
        description: faker.helpers.arrayElement([
          "Panel lay-up and wet-out",
          "Edge trim and deburr",
          "QA dimensional check",
        ]),
        hours_estimated: faker.number.float({ min: 1, max: 14, fractionDigits: 1 }),
        rate_aud: faker.number.float({ min: 85, max: 140, fractionDigits: 2 }),
      }));
      await supabase.from("job_materials").insert(materials);
      await supabase.from("job_labor").insert(labor);
    }
    console.log(`  Jobs ${batch * 10 + 1}–${(batch + 1) * 10}`);
  }
  console.log("✓ 100 jobs with materials & labour");
}

async function main() {
  console.log("FRP Engineering — industrial seed\n");
  await seedStaff();
  await seedInventory();
  await seedJobs();
  console.log("\n✓ Seed complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
