import { LiveTable } from "../LiveTable";
import { PageHeader } from "../ui";

/**
 * Success stories and awards, the two home-page sections nobody could fill.
 *
 * `/api/marketplace/proof` answers the home page with rows from
 * `marketplace_stories` and `marketplace_awards` where `published` is true, and
 * its own comment says those rows are the ones "an operator has published from
 * Marketplace Manager". No screen in the manager read either table, and neither
 * table allowed a row to be created, so both home-page sections were guaranteed
 * to stay empty for as long as that was true. Both are empty today.
 *
 * This is that screen. It is two live tables over the same whitelisted endpoint
 * every other connected section uses - no new store, no second copy of the data
 * and no invented customer: a story appears on the home page only once somebody
 * has written it here and set `published`.
 */
export function StoriesAwardsSection() {
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Growth · Proof"
        title="Stories & Awards"
        description="The customer stories and awards the marketplace home page is allowed to show. Nothing appears there until it is published here."
      />

      <div className="space-y-4">
        <LiveTable
          resource="stories"
          title="Success stories"
          columns={["company", "quote", "author", "role", "metric", "metric_label", "product_slug", "published", "sort_order"]}
          description="Reading the published stories…"
        />
        <LiveTable
          resource="awards"
          title="Awards & champions"
          columns={["category", "winner", "product_slug", "year", "published", "sort_order"]}
          description="Reading the published awards…"
        />
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        The home page reads these tables through <span className="font-mono">/api/marketplace/proof</span>,
        which returns only rows with <span className="font-mono">published</span> set. An unpublished row
        stays here and shows nowhere else; retiring a row unpublishes it rather than deleting it.
      </p>
    </div>
  );
}
