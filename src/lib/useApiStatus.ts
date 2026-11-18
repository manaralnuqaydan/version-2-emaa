import { useEffect, useState } from "react";
import { SIGN_API_URL } from "@/lib/arasl";

export type ApiStatus = {
  online: boolean;
  chatbot: boolean;
  models: Record<string, boolean>;
} | null;

// حالة خادم emaa الحقيقية (GET /): هل هو شغال، وهل مفتاح Claude موجود
export function useApiStatus(intervalMs = 15000): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch(`${SIGN_API_URL}/`, { cache: "no-store" });
        const d = await r.json();
        if (alive) setStatus({ online: true, chatbot: !!d.chatbot, models: d.models ?? {} });
      } catch {
        if (alive) setStatus({ online: false, chatbot: false, models: {} });
      }
    };
    check();
    const id = setInterval(check, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);
  return status;
}
