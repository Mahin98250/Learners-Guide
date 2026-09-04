import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALLED_KEY = "learner-guide-pwa-installed";

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

export default function InstallAppPrompt() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(INSTALLED_KEY) === "1") return;

    const handler = (event: Event): void => {
      if (isStandalone() || localStorage.getItem(INSTALLED_KEY) === "1") return;
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };

    const installed = (): void => {
      localStorage.setItem(INSTALLED_KEY, "1");
      setPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!prompt || isStandalone() || localStorage.getItem(INSTALLED_KEY) === "1") return null;

  return (
    <button
      type="button"
      aria-label="Install Learner's Guide app"
      onClick={async () => {
        const current = prompt;
        await current.prompt();
        const choice = await current.userChoice;
        setPrompt(null);
        if (choice.outcome === "accepted") {
          localStorage.setItem(INSTALLED_KEY, "1");
          window.dispatchEvent(new Event("learner-guide-installed"));
        }
      }}
      style={{
        position: "fixed",
        right: 20,
        bottom: "max(108px, calc(env(safe-area-inset-bottom) + 108px))",
        zIndex: 999,
        border: 0,
        borderRadius: 14,
        padding: "12px 18px",
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: "0 8px 24px rgba(0,0,0,.18)",
      }}
    >
      Install App
    </button>
  );
}
