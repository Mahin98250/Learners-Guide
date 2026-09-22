import { useEffect, useState } from "react";
import { LOGO_IMG_SRC } from "@/lg/ui";

/** Short launch transition using the real Mahin logo. */
export default function StartupMinimal() {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setExiting(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`lg-minimal-launch${exiting ? " lg-minimal-launch--exit" : ""}`} aria-hidden="true">
      <img className="lg-minimal-launch__logo" src={LOGO_IMG_SRC} alt="Mahin" />
      <style>{`
        .lg-minimal-launch{position:fixed;inset:0;z-index:2147483647;pointer-events:none;background:#fff;display:flex;align-items:center;justify-content:center;opacity:1;overflow:hidden;transition:opacity 240ms cubic-bezier(.22,1,.36,1)}
        .lg-minimal-launch--exit{opacity:0}
        .lg-minimal-launch__logo{width:min(190px,42vw);height:min(190px,42vw);object-fit:contain;display:block;animation:lg-minimal-logo-in 250ms cubic-bezier(.22,1,.36,1) both}
        @keyframes lg-minimal-logo-in{0%{opacity:0;transform:scale(.9)}100%{opacity:1;transform:scale(1)}}
        @media(prefers-reduced-motion:reduce){.lg-minimal-launch{transition:none}.lg-minimal-launch__logo{animation:none}}
      `}</style>
    </div>
  );
}
