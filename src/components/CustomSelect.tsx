import { useState, useRef, useEffect } from "react";
import type { KeyboardEvent } from "react";

type Option = string | { value: string; label: string };

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
}

export default function CustomSelect({ value, onChange, options, placeholder, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const opts = options.map(o => (typeof o === "string" ? { value: o, label: o } : o));
  const selIndex = opts.findIndex(o => o.value === value);
  const current = opts.find(o => o.value === value);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // 键盘高亮项滚入视野
  useEffect(() => {
    if (open && menuRef.current) {
      const el = menuRef.current.querySelector<HTMLElement>(`[data-idx="${hl}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [hl, open]);

  function openMenu() {
    setHl(selIndex < 0 ? 0 : selIndex);
    setOpen(true);
  }

  function select(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setHl(h => Math.min(h + 1, opts.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHl(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const o = opts[hl]; if (o) select(o.value); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  return (
    <div
      ref={wrapRef}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      style={{ position: "relative", outline: "none" }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "9px 13px",
          border: `1.5px solid ${open ? "var(--gold)" : "var(--border)"}`,
          borderRadius: "var(--radius)",
          fontSize: "var(--font-size-md)",
          color: current ? "var(--text)" : "var(--text-tertiary)",
          background: "var(--card)",
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: open ? "0 0 0 3px rgba(201,149,42,.1)" : "none",
          transition: "border-color .15s, box-shadow .15s",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current ? current.label : placeholder || "请选择"}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", color: "var(--text-secondary)" }}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 100,
            background: "var(--card)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-lg)",
            padding: 4,
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {opts.map((o, i) => {
            const active = o.value === value;
            const highlighted = i === hl;
            return (
              <div
                key={o.value}
                data-idx={i}
                onMouseEnter={() => setHl(i)}
                onClick={() => select(o.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontSize: "var(--font-size-md)",
                  background: highlighted ? "var(--gold-light)" : "transparent",
                  color: active ? "var(--gold-dark)" : "var(--text)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                {active && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ flexShrink: 0 }}>
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
