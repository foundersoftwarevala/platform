import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/boss")({
  component: BossRoute,
});

function BossRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: "/control-panel", replace: true });
  }, [navigate]);

  return null;
}
