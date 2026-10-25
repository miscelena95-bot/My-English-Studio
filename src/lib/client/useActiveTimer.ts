"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Measures active learning time: counts only while the tab is visible and the
 * learner has interacted in the last two minutes. Used so "learning time" in
 * progress stats reflects real practice rather than an open tab.
 */
export function useActiveTimer() {
  const seconds = useRef(0);
  const lastInteraction = useRef(0);

  useEffect(() => {
    lastInteraction.current = Date.now();
    const bump = () => (lastInteraction.current = Date.now());
    const events = ["keydown", "pointerdown", "pointermove", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastInteraction.current < 120_000) seconds.current += 1;
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(id);
    };
  }, []);

  return useCallback(() => seconds.current, []);
}
