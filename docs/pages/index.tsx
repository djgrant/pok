import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@notation/docs/ui";
import { Hero } from "#/views/landing/hero";
import { Features } from "#/views/landing/features";

export const Route = createFileRoute("/")({
  component: () => (
    <>
      <SiteHeader />
      <Hero />
      <Features />
    </>
  ),
});
