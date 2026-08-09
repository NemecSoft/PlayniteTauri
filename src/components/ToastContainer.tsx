// Simple toast notification container.

import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

interface Toast {
  id: number;
  title: string;
  body: string;
}

let idCounter = 0;

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unlisten = listen<{ title: string; body: string }>(
      "notification",
      (event: { payload: { title: string; body: string } }) => {
        const id = ++idCounter;
        setToasts((t) => [...t, { id, title: event.payload.title, body: event.payload.body }]);
        setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== id));
        }, 4000);
      }
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="fixed bottom-[18px] right-[18px] z-[2000] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          className="min-w-[220px] rounded-md border border-border-strong border-l-[3px] border-l-accent bg-panel p-3 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
          key={t.id}
        >
          <div className="mb-0.5 font-semibold">{t.title}</div>
          {t.body && <div className="text-xs text-secondary-text">{t.body}</div>}
        </div>
      ))}
    </div>
  );
}
