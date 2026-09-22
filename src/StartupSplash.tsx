import { useEffect, useState } from "react";

/**
 * Lightweight in-app launch animation for installed/mobile web-app launches.
 * It intentionally has no dependencies and disappears quickly so it never
 * interferes with authentication or any application workflow.
 */
export default function StartupSplash() {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setExiting(true), 760);
    const hideTimer = window.setTimeout(() => setVisible(false), 1040);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`startup-splash${exiting ? " startup-splash--exit" : ""}`}
      aria-hidden="true"
    >
      <div className="startup-splash__glow startup-splash__glow--one" />
      <div className="startup-splash__glow startup-splash__glow--two" />

      <div className="startup-splash__content">
        <div className="startup-splash__mark">
          <div className="startup-splash__book startup-splash__book--left" />
          <div className="startup-splash__book startup-splash__book--right" />
          <div className="startup-splash__person" />
          <div className="startup-splash__person-head" />
        </div>

        <div className="startup-splash__spark startup-splash__spark--one" />
        <div className="startup-splash__spark startup-splash__spark--two" />
        <div className="startup-splash__spark startup-splash__spark--three" />

        <div className="startup-splash__title">Mahin</div>
        <div className="startup-splash__tagline">Learn. Grow. Achieve.</div>
      </div>

      <style>{`
        .startup-splash {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: grid;
          place-items: center;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 42%, rgba(124, 92, 255, .14), transparent 34%),
            linear-gradient(145deg, #fbfcff 0%, #f3f5ff 48%, #eef1ff 100%);
          opacity: 1;
          transition: opacity 280ms ease, transform 280ms ease;
        }

        .startup-splash--exit {
          opacity: 0;
          transform: scale(1.025);
          pointer-events: none;
        }

        .startup-splash__content {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: startup-content-in 650ms cubic-bezier(.2,.8,.2,1) both;
        }

        .startup-splash__mark {
          position: relative;
          width: 122px;
          height: 122px;
          border-radius: 36px;
          display: grid;
          place-items: center;
          background: linear-gradient(145deg, #ffffff, #eef0ff);
          box-shadow:
            0 22px 55px rgba(54, 42, 128, .16),
            inset 0 1px 0 rgba(255,255,255,.95);
          animation: startup-mark-float 1.7s ease-in-out infinite;
        }

        .startup-splash__book {
          position: absolute;
          top: 28px;
          width: 48px;
          height: 56px;
          background: linear-gradient(155deg, #7167d8, #5047a8);
          border-radius: 7px 13px 7px 8px;
          box-shadow: 0 7px 16px rgba(80, 71, 168, .22);
        }

        .startup-splash__book--left {
          left: 28px;
          transform: skewY(9deg) rotate(-2deg);
          transform-origin: bottom right;
        }

        .startup-splash__book--right {
          right: 28px;
          transform: skewY(-9deg) rotate(2deg);
          transform-origin: bottom left;
          filter: brightness(.92);
        }

        .startup-splash__person {
          position: absolute;
          z-index: 2;
          bottom: 20px;
          width: 29px;
          height: 49px;
          border-radius: 22px 22px 11px 11px;
          background: linear-gradient(180deg, #27224e 0 34%, #5d55b8 35% 100%);
          transform: rotate(4deg);
        }

        .startup-splash__person-head {
          position: absolute;
          z-index: 3;
          top: 42px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #27224e;
          animation: startup-head-bob 1.2s ease-in-out infinite;
        }

        .startup-splash__spark {
          position: absolute;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #8d83f2;
          box-shadow: 0 0 14px rgba(141,131,242,.75);
          animation: startup-spark 1.4s ease-in-out infinite;
        }

        .startup-splash__spark--one { top: 4px; right: -18px; animation-delay: 0ms; }
        .startup-splash__spark--two { top: 52px; left: -28px; width: 5px; height: 5px; animation-delay: 260ms; }
        .startup-splash__spark--three { bottom: 12px; right: -24px; width: 4px; height: 4px; animation-delay: 520ms; }

        .startup-splash__title {
          margin-top: 25px;
          color: #27224e;
          font: 700 23px/1.15 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: -.35px;
        }

        .startup-splash__tagline {
          margin-top: 7px;
          color: #77739a;
          font: 500 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: .25px;
        }

        .startup-splash__glow {
          position: absolute;
          width: 230px;
          height: 230px;
          border-radius: 50%;
          filter: blur(45px);
          opacity: .34;
          animation: startup-glow 2.4s ease-in-out infinite alternate;
        }

        .startup-splash__glow--one {
          top: 20%;
          left: 6%;
          background: rgba(119, 103, 216, .18);
        }

        .startup-splash__glow--two {
          right: 3%;
          bottom: 12%;
          background: rgba(92, 173, 220, .15);
          animation-delay: -1.1s;
        }

        @keyframes startup-content-in {
          from { opacity: 0; transform: translateY(12px) scale(.94); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes startup-mark-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(.6deg); }
        }

        @keyframes startup-head-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }

        @keyframes startup-spark {
          0%, 100% { opacity: .25; transform: scale(.7) translateY(3px); }
          50% { opacity: 1; transform: scale(1.15) translateY(-5px); }
        }

        @keyframes startup-glow {
          from { transform: scale(.88); opacity: .22; }
          to { transform: scale(1.12); opacity: .38; }
        }

        @media (prefers-reduced-motion: reduce) {
          .startup-splash__content,
          .startup-splash__mark,
          .startup-splash__person-head,
          .startup-splash__spark,
          .startup-splash__glow {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
