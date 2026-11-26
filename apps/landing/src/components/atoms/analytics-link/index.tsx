"use client";

import type { ComponentPropsWithoutRef } from "react";
import { trackLandingEvent, type LandingEvent } from "@/lib/analytics";

export function AnalyticsLink({
  tracking,
  ...props
}: ComponentPropsWithoutRef<"a"> & { tracking: LandingEvent }) {
  return (
    <a
      {...props}
      onClick={() => trackLandingEvent(tracking)}
      onAuxClick={(event) => {
        if (event.button === 1) trackLandingEvent(tracking);
      }}
    />
  );
}
