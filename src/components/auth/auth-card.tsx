import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Eyebrow, H1, Text } from "@/components/ui/typography";

type AuthCardProps = { eyebrow: string; title: string; description: string; children: ReactNode };

export function AuthCard({ eyebrow, title, description, children }: AuthCardProps) {
  return (
    <div className="relative flex flex-1 items-start justify-center border-b-[3px] border-ink py-12 sm:items-center sm:py-16">
      <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-10" />
      <Container className="relative flex justify-center">
        <Card className="w-full max-w-md shadow-brutal-lg">
          <CardHeader className="gap-2 bg-mint text-on-accent">
            <Eyebrow className="text-on-accent">{eyebrow}</Eyebrow>
            <H1 className="text-3xl sm:text-4xl">{title}</H1>
            <Text className="text-on-accent/80">{description}</Text>
          </CardHeader>
          <CardBody>{children}</CardBody>
        </Card>
      </Container>
    </div>
  );
}

/** Skeleton shown while a form that reads the URL is prerendered. */
export function FormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-5">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="h-4 w-24 bg-muted" />
          <div className="h-11 rounded-brutal border-[3px] border-ink/20 bg-muted" />
        </div>
      ))}
      <div className="h-14 rounded-brutal border-[3px] border-ink/20 bg-muted" />
    </div>
  );
}
