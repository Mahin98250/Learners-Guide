import { useEffect, useState } from "react";

export default function InstallAppPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!prompt) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await prompt.prompt();
        setPrompt(null);
      }}
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 9999,
        border: 0,
        borderRadius: 14,
        padding: "12px 18px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      Install App
    </button>
  );
}

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  }
}
