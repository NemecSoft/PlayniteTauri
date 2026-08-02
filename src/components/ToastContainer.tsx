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
    <div className="toast-container">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          <div className="toast-title">{t.title}</div>
          {t.body && <div className="toast-body">{t.body}</div>}
        </div>
      ))}
    </div>
  );
}
