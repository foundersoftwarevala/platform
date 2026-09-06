import { AlertTriangle, CheckCircle, LogOut, Settings } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { CatalogueScreen, statusBadge } from "../common/CatalogueScreen";
import { ConfirmButton } from "../common/ConfirmButton";
import { subsectionLabel } from "../common/subsection";

interface LMSettingsProps {
  activeSubSection: string;
}

const LMSettings = ({ activeSubSection }: LMSettingsProps) => (
  <CatalogueScreen
    title="Settings"
    description="Legal configuration, notification rules and security posture"
    icon={Settings}
    category="setting"
    tableTitle="Configuration"
    focusLabel={subsectionLabel(activeSubSection)}
    columns={[
      { key: "name", header: "Setting" },
      { key: "type", header: "Area" },
      { key: "description", header: "Purpose" },
      { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
    ]}
    actions={[
      { label: "Mark configured", status: "configured", action: "Setting Configured", icon: CheckCircle, confirm: false },
      { label: "Needs review", status: "review", action: "Setting Flagged For Review", icon: AlertTriangle, confirm: true },
    ]}
  >
    <Card className="border-destructive/30 bg-destructive/10">
      <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-destructive/20">
            <LogOut className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground">End session</h3>
            <p className="truncate text-sm text-muted-foreground">
              Sign out of the legal manager workspace on this device
            </p>
          </div>
        </div>
        <ConfirmButton
          variant="destructive"
          title="End this session?"
          description="You will be signed out of the legal manager workspace on this device."
          confirmLabel="Log out"
          onConfirm={() => toast.success("Session ended")}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Logout
        </ConfirmButton>
      </CardContent>
    </Card>
  </CatalogueScreen>
);

export default LMSettings;
