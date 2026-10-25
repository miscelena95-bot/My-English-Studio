import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { IconAlert, IconCheck, IconInfo } from "./icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "normal" | "small";

function btnClass(variant: Variant = "secondary", size: Size = "normal", extra?: string) {
  return ["btn", variant !== "secondary" && `btn-${variant}`, size === "small" && "btn-small", extra].filter(Boolean).join(" ");
}

export function Button({
  variant,
  size,
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={btnClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={btnClass(variant, size, className)} {...rest} />;
}

export function Card({ className, flat, ...rest }: ComponentProps<"div"> & { flat?: boolean }) {
  return <div className={["card", flat && "card-flat", className].filter(Boolean).join(" ")} {...rest} />;
}

export function CardLink({ className, ...rest }: ComponentProps<typeof Link>) {
  return <Link className={["card card-link", className].filter(Boolean).join(" ")} {...rest} />;
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  children,
  breadcrumbs,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  breadcrumbs?: Array<{ href: string; label: string }>;
}) {
  return (
    <header className="page-header">
      {breadcrumbs && (
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((b, i) => (
            <span key={b.href}>
              {i > 0 && " / "}
              <Link href={b.href}>{b.label}</Link>
            </span>
          ))}
        </nav>
      )}
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {lede && <p className="lede">{lede}</p>}
      {children}
    </header>
  );
}

export type Tone = "neutral" | "accent" | "clay" | "success" | "warning" | "danger" | "info";

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={tone === "neutral" ? "badge" : `badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  role,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title?: ReactNode;
  children?: ReactNode;
  role?: "status" | "alert";
}) {
  const Icon = tone === "success" ? IconCheck : tone === "info" ? IconInfo : IconAlert;
  return (
    <div className={tone === "info" ? "notice" : `notice notice-${tone}`} role={role ?? (tone === "error" ? "alert" : undefined)}>
      <Icon />
      <div>
        {title && <p style={{ fontWeight: 600, marginBottom: children ? 4 : 0 }}>{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  label,
  tone,
  thin,
}: {
  value: number;
  max?: number;
  label: string;
  tone?: "clay";
  thin?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      className={["progress", tone && `progress-${tone}`, thin && "progress-thin"].filter(Boolean).join(" ")}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ value, label, hint }: { value: ReactNode; label: string; hint?: string }) {
  return (
    <div className="stat" title={hint}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <div className="muted small measure" style={{ margin: "0 auto 16px" }}>{children}</div>}
      {action}
    </div>
  );
}

export function SectionHead({ title, action, id }: { title: string; action?: ReactNode; id?: string }) {
  return (
    <div className="section-head">
      <h2 id={id}>{title}</h2>
      {action}
    </div>
  );
}
