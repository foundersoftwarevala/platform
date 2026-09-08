import { pageHead } from "@/lib/seo-head";
import { createFileRoute } from '@tanstack/react-router';
import { RecoveryTrigger } from '@/components/marketplace-manager/RecoveryTrigger';

export const Route = createFileRoute('/marketplace-recovery')({
  head: pageHead("Marketplace Recovery", "Recovery tools for the marketplace catalogue."),
  component: RecoveryTrigger,
});
