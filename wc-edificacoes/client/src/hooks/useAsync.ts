import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api";

/** Carrega dados assíncronos ignorando respostas de requisições antigas (evita "race conditions"). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const callId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const load = useCallback(async () => {
    const id = ++callId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await run();
      if (id === callId.current) setData(result);
    } catch (err) {
      if (id === callId.current) setError(errorMessage(err));
    } finally {
      if (id === callId.current) setLoading(false);
    }
  }, [run]);

  useEffect(() => { void load(); }, [load]);

  return { data, error, loading, reload: load, setData };
}
