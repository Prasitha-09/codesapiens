import type { ReactNode } from "react";
import { Eyebrow, H1, Lead } from "@/components/ui/typography";
import { Container } from "./container";

type PageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or other controls shown beside the title on wide screens. */
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="relative overflow-hidden border-b-[3px] border-ink bg-paper">
      <div aria-hidden="true" className="bg-lines absolute inset-0" />
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-2 bg-mint" />
      <Container className="relative flex flex-col gap-6 py-10 sm:py-14 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-3xl flex-col gap-3">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <H1 className="break-words">{title}</H1>
          {description && <Lead>{description}</Lead>}
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </Container>
    </header>
  );
}
