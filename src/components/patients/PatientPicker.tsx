import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Search, UserPlus, X } from "lucide-react";
import { ageLabel, allergyList, type Patient } from "../../types/patients";
import { patientsApi } from "../../services/patients";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const MAX_RESULTS = 8;

/**
 * Searchable list of registered patients, searched in the hospital database as you type. Staff can only choose someone already
 * on the register, so nobody is billed, booked, admitted or treated without a patient file.
 */
export default function PatientPicker({
  value,
  onChange,
  label = "Patient",
  autoFocus = false,
  disabled = false,
  showAllergies = false,
  exclude,
}: {
  value: Patient | null;
  onChange: (p: Patient | null) => void;
  label?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Show the patient's known allergies under the field (clinical forms). */
  showAllergies?: boolean;
  /** Hide this patient id from the results (e.g. when merging, so a record can't be picked against itself). */
  exclude?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<Patient[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Ask the server whenever the list is open and the text changes. An empty box shows the first few patients A to Z.
  useEffect(() => {
    if (!open) return;
    let stale = false;
    setStatus("loading");
    const timer = window.setTimeout(
      () => {
        patientsApi
          .list({ search: query.trim(), limit: MAX_RESULTS + 1 }) // one extra, in case the excluded patient is among them
          .then((r) => {
            if (stale) return;
            setResults(r.patients.filter((p) => p.id !== exclude).slice(0, MAX_RESULTS));
            setStatus("ready");
          })
          .catch(() => !stale && setStatus("error"));
      },
      query ? 250 : 0
    );
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [open, query, exclude]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (p: Patient) => {
    onChange(p);
    setQuery("");
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && results[active]) {
      e.preventDefault(); // don't submit the surrounding form
      choose(results[active]);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation(); // close the list, not the modal
      setOpen(false);
    }
  };

  const allergies = value ? allergyList(value) : [];

  return (
    <div ref={box} className="relative text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-800">{value.name}</span>
            <span className="block truncate text-xs text-slate-500">
              {value.id} · {ageLabel(value.dob)} · {value.gender}
              {value.phone && ` · ${value.phone}`}
            </span>
          </span>
          {!disabled && (
            <button type="button" onClick={() => onChange(null)} aria-label="Change patient" className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputClass} pl-9`}
              value={query}
              autoFocus={autoFocus}
              disabled={disabled}
              placeholder="Search registered patient by name, ID or phone"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setActive(0);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKey}
            />
          </div>
          {open && (
            <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {results.map((p, i) => (
                <li key={p.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(p)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${i === active ? "bg-blue-50" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-slate-800">{p.name}</span>
                      <span className="block truncate text-xs text-slate-500">{p.id} · {ageLabel(p.dob)} · {p.gender}{p.phone && ` · ${p.phone}`}</span>
                    </span>
                    {allergyList(p).length > 0 && <AlertTriangle size={14} className="shrink-0 text-amber-500" aria-label="Has allergies" />}
                  </button>
                </li>
              ))}
              {status === "loading" && results.length === 0 && <li className="px-3 py-3 text-slate-500">Searching…</li>}
              {status === "error" && (
                <li role="alert" className="px-3 py-3 text-rose-600">
                  Couldn't search the patient register. Check your connection and try again.
                </li>
              )}
              {status === "ready" && results.length === 0 && (
                <li className="space-y-2 px-3 py-3 text-slate-500">
                  <p>No registered patient matches "{query}".</p>
                  <Link to="/patients" className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:underline"><UserPlus size={14} /> Register the patient first</Link>
                </li>
              )}
            </ul>
          )}
        </>
      )}
      {showAllergies && allergies.length > 0 && (
        <p className="mt-1.5 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
          <AlertTriangle size={13} /> Allergies: {allergies.join(", ")}
        </p>
      )}
    </div>
  );
}