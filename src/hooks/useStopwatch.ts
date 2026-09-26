import { useCallback, useEffect, useRef, useState } from "react";

/** Duraklatılabilir kronometre; duraklatılan süre okuma süresine eklenmez. */
export function useStopwatch() {
  const startRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const [running, setRunning] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [running]);

  const elapsedMs = useCallback(
    () => accRef.current + (startRef.current !== null ? performance.now() - startRef.current : 0),
    [],
  );
  const start = useCallback(() => {
    if (startRef.current === null) startRef.current = performance.now();
    setRunning(true);
  }, []);
  const pause = useCallback(() => {
    if (startRef.current !== null) accRef.current += performance.now() - startRef.current;
    startRef.current = null;
    setRunning(false);
  }, []);
  const reset = useCallback(() => {
    startRef.current = null;
    accRef.current = 0;
    setRunning(false);
  }, []);

  return { running, elapsedMs, start, pause, reset };
}

export function formatClock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
