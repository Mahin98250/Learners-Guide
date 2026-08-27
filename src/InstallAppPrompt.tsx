import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

export default function InstallAppPrompt() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;

    const handler = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const installed = () => setPrompt(null);

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!prompt) return null;

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
          window.dispatchEvent(new Event("learner-guide-installed"));
        }
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
