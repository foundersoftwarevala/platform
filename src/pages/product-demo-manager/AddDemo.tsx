import { Suspense, lazy } from "react";

// Keep the existing cross-module edge lazy to avoid the initialization cycle.
const DemoUrlManagerSection = lazy(() =>
  import("@/components/marketplace-manager/sections/DemoUrlManager").then((module) => ({
    default: module.DemoUrlManagerSection,
  })),
);

interface AddDemoProps {
  onSuccess: () => void;
}

const AddDemo = ({ onSuccess }: AddDemoProps) => {
  void onSuccess;
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Loading the URL manager…</p>}>
      <DemoUrlManagerSection />
    </Suspense>
  );
};

export default AddDemo;
