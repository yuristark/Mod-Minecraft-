import { site } from "@/config/site";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0", className)} aria-hidden="true">
      <rect width="64" height="64" fill="currentColor" />
      <path d="M10 20 L21 46 L32 27 L43 46 L54 20" fill="none" stroke="#e8642c" strokeWidth="5" strokeLinejoin="miter" />
    </svg>
  );
}

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark className={cn("h-9 w-9", tone === "light" ? "text-paper" : "text-ink")} />
      <span className="whitespace-nowrap leading-none">
        <span className="block text-[1.05rem] font-extrabold uppercase stretch-wide tracking-tight">
          {site.shortName}
          <span className="font-semibold"> Edificações</span>
        </span>
        <span className={cn("label-mono block mt-1 text-[0.6rem]", tone === "light" ? "text-paper/60" : "text-ink-3")}>
          {site.tagline}
        </span>
      </span>
    </span>
  );
}

export function SectionLabel({ index, children, className }: { index?: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("label-mono flex items-center gap-3", className)}>
      {index && <span className="text-signal-strong [.on-dark_&]:text-signal">{index}</span>}
      <span aria-hidden="true" className="h-px w-8 bg-current opacity-40" />
      <span>{children}</span>
    </p>
  );
}
