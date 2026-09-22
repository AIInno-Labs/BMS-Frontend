"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Auto-dismisses a transient status message after `delayMs`, pausing the
 * countdown while the pointer is over it (so it can't vanish mid-read) and
 * resuming from where it left off on mouse leave.
 *
 * `value` is whatever currently shows the message (a boolean flag, or the
 * message string/null itself). Falsy disarms the timer. `onDismiss` should
 * clear that same state. Spread the returned handlers onto the message
 * element (or its wrapper).
 */
export function useAutoDismiss<T>(
  value: T,
  onDismiss: () => void,
  delayMs = 5000
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(delayMs);
  const startedAtRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const arm = useCallback(
    (ms: number) => {
      clearTimer();
      startedAtRef.current = Date.now();
      timerRef.current = setTimeout(onDismiss, ms);
    },
    [clearTimer, onDismiss]
  );

  useEffect(() => {
    if (!value) {
      clearTimer();
      return;
    }
    remainingRef.current = delayMs;
    arm(delayMs);
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delayMs]);

  const onMouseEnter = useCallback(() => {
    if (!value || timerRef.current == null) return;
    remainingRef.current = Math.max(
      remainingRef.current - (Date.now() - startedAtRef.current),
      0
    );
    clearTimer();
  }, [value, clearTimer]);

  const onMouseLeave = useCallback(() => {
    if (!value) return;
    arm(remainingRef.current > 0 ? remainingRef.current : delayMs);
  }, [value, arm, delayMs]);

  return { onMouseEnter, onMouseLeave };
}
