import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { Display, Lead } from "@/components/ui/typography";

export default function NotFound() {
  return (
    <Container className="flex flex-1 flex-col items-start justify-center gap-6 py-20">
      <span className="border-[3px] border-ink bg-pink px-3 py-1 font-mono font-bold text-on-accent shadow-brutal">404</span>
      <Display>Page not found</Display>
      <Lead>That page doesn&apos;t exist, or it isn&apos;t available to you.</Lead>
      <ButtonLink href="/">Go home</ButtonLink>
    </Container>
  );
}
