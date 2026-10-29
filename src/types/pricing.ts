export const CATEGORIES = [
  "Consultation",
  "Laboratory",
  "Imaging & Diagnostics",
  "Pharmacy",
  "Nursing Care",
  "Procedures",
  "Admission & Ward",
  "Maternity",
  "Surgery",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface PriceItem {
  id: string;
  code: string;
  name: string;
  category: Category;
  unit: string; // e.g. "per visit", "per test", "per day"
  price: number; // Nigerian Naira
}

export const CATEGORY_PREFIX: Record<Category, string> = {
  Consultation: "CON",
  Laboratory: "LAB",
  "Imaging & Diagnostics": "IMG",
  Pharmacy: "PHM",
  "Nursing Care": "NUR",
  Procedures: "PRO",
  "Admission & Ward": "ADM",
  Maternity: "MAT",
  Surgery: "SUR",
};

const mk = (category: Category, rows: [string, number, string][]): PriceItem[] =>
  rows.map(([name, price, unit], i) => ({
    id: `${CATEGORY_PREFIX[category]}-${i + 1}`,
    code: `${CATEGORY_PREFIX[category]}-${String(i + 1).padStart(3, "0")}`,
    name,
    category,
    unit,
    price,
  }));

// Starting prices are illustrative. Edit them on the Price List page to match your facility.
export const defaultPriceList: PriceItem[] = [
  ...mk("Consultation", [
    ["General OPD consultation", 5000, "per visit"],
    ["Follow-up visit (within 7 days)", 3000, "per visit"],
    ["Specialist consultation", 10000, "per visit"],
    ["Consultant review", 15000, "per visit"],
    ["Paediatric consultation", 6000, "per visit"],
    ["Antenatal booking consultation", 8000, "per visit"],
    ["Emergency / casualty consultation", 8000, "per visit"],
    ["After-hours consultation", 15000, "per visit"],
    ["Psychiatric evaluation", 20000, "per session"],
    ["Medical report / fitness certificate", 10000, "each"],
  ]),
  ...mk("Laboratory", [
    ["Full blood count (FBC)", 4500, "per test"],
    ["Malaria parasite (MP)", 1500, "per test"],
    ["Widal test", 2500, "per test"],
    ["Fasting blood sugar", 1500, "per test"],
    ["Random blood sugar", 1000, "per test"],
    ["HbA1c", 8000, "per test"],
    ["Urinalysis", 2000, "per test"],
    ["Urine microscopy, culture & sensitivity", 5000, "per test"],
    ["Stool microscopy", 2000, "per test"],
    ["Stool culture & sensitivity", 5000, "per test"],
    ["Blood group & genotype", 2500, "per test"],
    ["Hepatitis B surface antigen (HBsAg)", 3000, "per test"],
    ["Hepatitis C antibody (HCV)", 3500, "per test"],
    ["HIV screening", 2500, "per test"],
    ["Pregnancy test (urine)", 1500, "per test"],
    ["Liver function test (LFT)", 9000, "per test"],
    ["Kidney function test (E/U/Cr)", 9000, "per test"],
    ["Lipid profile", 8500, "per test"],
    ["Thyroid function test (TFT)", 15000, "per test"],
    ["Prostate specific antigen (PSA)", 8000, "per test"],
    ["Erythrocyte sedimentation rate (ESR)", 1500, "per test"],
    ["Packed cell volume (PCV)", 1000, "per test"],
    ["Blood culture & sensitivity", 10000, "per test"],
    ["Wound swab culture & sensitivity", 6000, "per test"],
    ["Semen analysis", 5000, "per test"],
    ["VDRL (syphilis screening)", 2500, "per test"],
    ["H. pylori antigen", 4000, "per test"],
    ["Uric acid", 3000, "per test"],
  ]),
  ...mk("Imaging & Diagnostics", [
    ["Abdominal ultrasound scan", 10000, "per scan"],
    ["Pelvic ultrasound scan", 8000, "per scan"],
    ["Obstetric ultrasound scan", 8000, "per scan"],
    ["Doppler ultrasound scan", 25000, "per scan"],
    ["Chest X-ray", 8000, "per view"],
    ["Limb X-ray", 7000, "per view"],
    ["Spine X-ray", 10000, "per view"],
    ["Electrocardiogram (ECG)", 7000, "per test"],
    ["Echocardiogram", 35000, "per test"],
    ["Electroencephalogram (EEG)", 25000, "per test"],
    ["CT scan (head)", 60000, "per scan"],
  ]),
  ...mk("Pharmacy", [
    ["Paracetamol 500mg tablets", 500, "per strip"],
    ["Ibuprofen 400mg tablets", 600, "per strip"],
    ["Diclofenac 50mg tablets", 700, "per strip"],
    ["Amoxicillin 500mg capsules", 2500, "per course"],
    ["Amoxicillin/Clavulanate 625mg", 6500, "per pack"],
    ["Ciprofloxacin 500mg tablets", 1800, "per strip"],
    ["Metronidazole 400mg tablets", 700, "per strip"],
    ["Azithromycin 500mg tablets", 3000, "per strip"],
    ["Artemether/Lumefantrine (antimalarial)", 2500, "per course"],
    ["Artesunate injection", 3500, "per vial"],
    ["Metformin 500mg tablets", 800, "per strip"],
    ["Amlodipine 5mg tablets", 1200, "per strip"],
    ["Lisinopril 10mg tablets", 1500, "per strip"],
    ["Omeprazole 20mg capsules", 1200, "per strip"],
    ["Oral rehydration salts (ORS)", 300, "per sachet"],
    ["Vitamin C 500mg tablets", 500, "per strip"],
    ["Ferrous sulphate tablets", 600, "per strip"],
    ["Folic acid 5mg tablets", 400, "per strip"],
    ["Cetirizine 10mg tablets", 500, "per strip"],
    ["Salbutamol inhaler", 3500, "each"],
    ["Normal saline 0.9% (500ml)", 1800, "per bag"],
    ["Dextrose 5% (500ml)", 1800, "per bag"],
    ["Ringer's lactate (500ml)", 2000, "per bag"],
    ["Ceftriaxone 1g injection", 2500, "per vial"],
    ["Gentamicin injection", 800, "per ampoule"],
    ["Hydrocortisone injection", 1800, "per vial"],
    ["Diazepam 10mg injection", 1500, "per ampoule"],
    ["Tetanus toxoid injection", 2000, "per dose"],
    ["Syringe & needle", 100, "each"],
  ]),
  ...mk("Nursing Care", [
    ["Dressing — small wound", 2500, "per dressing"],
    ["Dressing — large wound", 5000, "per dressing"],
    ["Injection administration", 1000, "per injection"],
    ["IV cannulation", 2000, "per procedure"],
    ["IV infusion set-up & monitoring", 3000, "per day"],
    ["Urinary catheterisation", 6000, "per procedure"],
    ["Nebulisation", 3500, "per session"],
    ["Vital signs monitoring", 1500, "per day"],
    ["Blood sugar monitoring", 1000, "per check"],
    ["Suture removal", 3000, "per procedure"],
    ["Enema", 4000, "per procedure"],
    ["Nasogastric tube insertion", 5000, "per procedure"],
    ["Oxygen therapy", 3000, "per hour"],
    ["Blood transfusion nursing care", 8000, "per unit"],
    ["Wound irrigation", 3000, "per session"],
    ["Ear syringing", 3500, "per session"],
    ["Immunisation administration", 1500, "per dose"],
    ["General nursing care (bed bath, positioning)", 5000, "per day"],
  ]),
  ...mk("Procedures", [
    ["Suturing of minor wound", 8000, "per procedure"],
    ["Incision & drainage (abscess)", 15000, "per procedure"],
    ["Wound debridement", 15000, "per procedure"],
    ["Plaster of Paris (POP) casting", 20000, "per cast"],
    ["Circumcision (infant)", 15000, "per procedure"],
    ["Circumcision (adult)", 40000, "per procedure"],
    ["Lumbar puncture", 25000, "per procedure"],
    ["Joint aspiration", 20000, "per procedure"],
    ["Foreign body removal (ear / nose)", 10000, "per procedure"],
    ["Minor biopsy", 25000, "per procedure"],
    ["Nail avulsion", 12000, "per procedure"],
    ["Cautery of warts", 15000, "per session"],
  ]),
  ...mk("Admission & Ward", [
    ["New patient card registration", 2000, "one-off"],
    ["Hospital card renewal", 1000, "per year"],
    ["Admission fee", 5000, "per admission"],
    ["Observation bed", 5000, "per 6 hours"],
    ["Paediatric ward", 12000, "per day"],
    ["General ward", 15000, "per day"],
    ["Semi-private room", 25000, "per day"],
    ["Private room", 40000, "per day"],
    ["VIP room", 60000, "per day"],
    ["Intensive care unit (ICU)", 100000, "per day"],
    ["Ambulance (within city)", 15000, "per trip"],
  ]),
  ...mk("Maternity", [
    ["Antenatal visit", 3000, "per visit"],
    ["Postnatal visit", 3000, "per visit"],
    ["Normal delivery (SVD)", 85000, "per delivery"],
    ["Episiotomy & repair", 15000, "per procedure"],
    ["Assisted delivery (vacuum / forceps)", 120000, "per delivery"],
    ["Caesarean section", 250000, "per surgery"],
    ["Newborn care", 5000, "per day"],
    ["Dilatation & curettage (D&C)", 80000, "per procedure"],
    ["Family planning — implant insertion", 15000, "per procedure"],
    ["Family planning — IUD insertion", 12000, "per procedure"],
  ]),
  ...mk("Surgery", [
    ["Theatre fee (minor)", 30000, "per procedure"],
    ["Anaesthesia fee (minor)", 20000, "per procedure"],
    ["Lipoma / cyst excision", 60000, "per surgery"],
    ["Hydrocelectomy", 150000, "per surgery"],
    ["Herniorrhaphy (hernia repair)", 220000, "per surgery"],
    ["Appendicectomy", 250000, "per surgery"],
    ["Myomectomy", 350000, "per surgery"],
    ["Hysterectomy", 400000, "per surgery"],
    ["Cholecystectomy", 400000, "per surgery"],
    ["Fracture fixation (ORIF)", 450000, "per surgery"],
  ]),
];

const STORAGE_KEY = "hms_price_list";

// Browser storage only, until the backend exists.
export function loadPriceList(): PriceItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PriceItem[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* fall through to defaults */
  }
  return defaultPriceList;
}

export function savePriceList(list: PriceItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: changes last until reload */
  }
}

export function resetPriceList() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return defaultPriceList;
}

export function nextCode(category: Category, list: PriceItem[]) {
  const prefix = CATEGORY_PREFIX[category];
  const max = list.reduce((m, i) => {
    if (!i.code.startsWith(`${prefix}-`)) return m;
    const n = parseInt(i.code.slice(prefix.length + 1), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export const newId = () => Math.random().toString(36).slice(2, 10);