import React from "react";

export default function LampIcon({ active, size = 26 }) {
  return (
    <span className={`lamp-icon${active ? " lamp-active" : ""}`} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <g className="lamp-rays" strokeWidth="1.6" strokeLinecap="round">
          <path d="M12 1.2v1.5" />
          <path d="M4.6 4.8l1.1 1.1" />
          <path d="M19.4 4.8l-1.1 1.1" />
          <path d="M2.2 9.6h1.5" />
          <path d="M21.8 9.6h-1.5" />
        </g>
        <path
          className="lamp-body"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 4a5.5 5.5 0 0 1 3.35 9.86c-.6.48-.95 1.24-.95 2.04v.3h-4.8v-.3c0-.8-.35-1.56-.95-2.04A5.5 5.5 0 0 1 12 4z"
        />
        <path
          className="lamp-flame"
          d="M12 7.7c.85 1.05 1.6 1.85 1.6 2.85a1.6 1.6 0 1 1-3.2 0c0-1 .75-1.8 1.6-2.85z"
        />
        <g className="lamp-base" strokeWidth="1.6" strokeLinecap="round">
          <path d="M9.8 18.4h4.4" />
          <path d="M10.7 20.6h2.6" />
        </g>
      </svg>
    </span>
  );
}
