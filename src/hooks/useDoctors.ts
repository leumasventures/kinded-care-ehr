import { useEffect, useState } from "react";
import { doctorsApi, type DoctorProfile } from "../services/doctors";

/** Loads real doctors from the database (never demo seed names). */
export function useDoctors() {
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    doctorsApi
      .list()
      .then((list) => alive && setDoctors(list))
      .catch(() => alive && setDoctors([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const names = doctors.map((d) => d.name).filter(Boolean);
  return { doctors, names, loading };
}
