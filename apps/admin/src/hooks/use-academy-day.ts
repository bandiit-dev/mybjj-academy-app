"use client";

import { academyToday } from "@mybjj/backend/convex/lib/studentPlans";
import { useEffect, useState } from "react";

export function useAcademyDay() {
  const [day, setDay] = useState(academyToday);
  useEffect(() => {
    const timer = window.setInterval(() => setDay(academyToday()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return day;
}
