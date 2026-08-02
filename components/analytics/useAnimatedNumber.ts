"use client";

import { useEffect, useRef, useState } from "react";

/** Eased count-up/down when `target` changes (for live KPI tiles). */
export function useAnimatedNumber(target: number, durationMs = 550): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    if (durationMs <= 0) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    const to = target;
    if (from === to) return;

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  useEffect(() => {
    if (fromRef.current !== target && display === target) {
      fromRef.current = target;
    }
  }, [display, target]);

  return display;
}
