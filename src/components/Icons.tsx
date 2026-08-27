type IconProps = { size?: number };

function base(size?: number) {
  return {
    width: size || 20,
    height: size || 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { verticalAlign: "-0.15em" },
  };
}

export function ReceiptIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

export function UsersIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.7-3.2 3.3-5 6.5-5s5.8 1.8 6.5 5" />
      <circle cx="16.5" cy="9" r="2.8" />
      <path d="M21.5 20c-.5-2.5-2.3-4-4.5-4.4" />
    </svg>
  );
}

export function ListIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h10M7 13h10M7 17h6" />
    </svg>
  );
}

export function ScissorsIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8.2 8l11.3 11.3M8.2 16l11.3-11.3" />
    </svg>
  );
}

export function ChartIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20v-10M17 20V7" />
    </svg>
  );
}

export function GearIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </svg>
  );
}

export function WalletIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M3 10h6a3 3 0 0 1 0 6H3" />
      <circle cx="16.5" cy="13" r=".8" />
    </svg>
  );
}

export function BagIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 8h12l1 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function CreditCardIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

export function FlameIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3c1.5 2.5-2 3.5-2 6.5 0 1.5 1 2.5 2 2.5s2-1 2-2.5c0-2.5 1.5-4 0-6.5z" />
      <path d="M12 22a6 6 0 0 0 6-6c0-3-1.5-5-3.5-7-.5 1.5-1.2 3-2.5 3.5C11 11.5 10 10 10 9c-2 2.5-4 5.5-4 7a6 6 0 0 0 6 6z" />
    </svg>
  );
}

export function FolderIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 14l2-2 2 2 2.5-2.5" />
    </svg>
  );
}

export function SpeakerIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 9v6h3l4 4V5L7 9z" />
      <path d="M15 8a4 4 0 0 1 0 8M17 5.5a7.5 7.5 0 0 1 0 13" />
    </svg>
  );
}

export function PaletteIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 1.4-3.4A2 2 0 0 1 15 15h3a3 3 0 0 0 3-3 9 9 0 0 0-9-9z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10.5" cy="7.5" r="1" />
      <circle cx="15" cy="7.5" r="1" />
      <circle cx="17" cy="11.5" r="1" />
    </svg>
  );
}

export function ImportIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 21h16" />
    </svg>
  );
}

export function ExportIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 15V3" />
      <path d="M7 8l5-5 5 5" />
      <path d="M4 21h16" />
    </svg>
  );
}

export function TrashIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function SaveIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 4h13l3 3v13H4z" />
      <path d="M8 4v5h8V4" />
      <path d="M8 20v-6h8v6" />
    </svg>
  );
}

export function AlertIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3 2.5 20h19z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  );
}
