import { Package, CheckCircle, Unlock } from "lucide-react";

import { CatalogueScreen, statusBadge } from "../common/CatalogueScreen";
import { subsectionLabel } from "../common/subsection";

interface LMProductLegalBindingProps {
  activeSubSection: string;
}

const LMProductLegalBinding = ({ activeSubSection }: LMProductLegalBindingProps) => (
  <CatalogueScreen
    title="Product Legal Binding"
    description="Bind mandatory legal agreements to software products"
    icon={Package}
    category="product_binding"
    tableTitle="Product Agreement Bindings"
    focusLabel={subsectionLabel(activeSubSection)}
    columns={[
      { key: "name", header: "Product" },
      { key: "agreement", header: "Agreement" },
      { key: "expiry", header: "Expiry" },
      { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
    ]}
    actions={[
      { label: "Bind", status: "bound", action: "Product Binding Activated", icon: CheckCircle, confirm: false },
      { label: "Release", status: "pending", action: "Product Binding Released", icon: Unlock, confirm: true },
    ]}
  />
);

export default LMProductLegalBinding;
