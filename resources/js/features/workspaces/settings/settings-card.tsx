import type { ReactNode } from "react";
import { fieldClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "danger";
  children: ReactNode;
};

/** One section of Pengaturan (SPengaturan card): h2 22px, description, radius 24 card. */
export function SettingsCard({ id, title, description, action, tone, children }: Props) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        "flex scroll-mt-24 flex-col overflow-hidden rounded-panel border bg-surface shadow-card",
        tone === "danger" ? "border-danger/40" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-6 pb-3 md:px-7">
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            id={`${id}-title`}
            className={cn(
              "text-[20px] leading-7 font-bold md:text-[22px]",
              tone === "danger" ? "text-danger" : "text-text",
            )}
          >
            {title}
          </h2>
          {description && <p className="text-label font-normal text-text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Native select in the Arus field style (44px, radius 12). */
export const selectClass = cn(fieldClasses, "h-11 w-auto pr-8");
