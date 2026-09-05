import { createFileRoute } from '@tanstack/react-router';
import { RecoveryTrigger } from '@/components/marketplace-manager/RecoveryTrigger';

export const Route = createFileRoute('/marketplace-recovery')({
  component: RecoveryTrigger,
});
