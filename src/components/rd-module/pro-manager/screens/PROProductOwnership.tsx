import { usePMProducts } from "@/hooks/rd-module/useProManagerData";
import { PMBadge, PMEmpty, PMLoading, PMPanel, PMSection } from "../pm-ui";

export const PROProductOwnership = ({ search = "" }: { search?: string }) => {
  const { data, isLoading } = usePMProducts();
  const term = search.trim().toLowerCase();
  const products = (data ?? []).filter((row) =>
    term
      ? [row.user_code, row.product, row.version, row.modules.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(term)
      : true,
  );

  return (
    <PMSection
      title="Product ownership"
      description="Which product edition, version and modules each premium account owns."
    >
      {isLoading ? (
        <PMLoading rows={4} />
      ) : products.length === 0 ? (
        <PMPanel>
          <PMEmpty message="No ownership records match this search." />
        </PMPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((row) => (
            <PMPanel
              key={row.id}
              title={row.user_code}
              description={`${row.product} • v${row.version}`}
            >
              <div className="flex flex-wrap gap-1.5">
                {row.modules.map((module) => (
                  <PMBadge key={module} tone="brand">
                    {module}
                  </PMBadge>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                <span className="text-foreground">Custom changes:</span>{" "}
                {row.custom_changes || "None recorded"}
              </p>
            </PMPanel>
          ))}
        </div>
      )}
    </PMSection>
  );
};
