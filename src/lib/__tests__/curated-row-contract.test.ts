import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function fixture(rows: unknown[]) {
  const source = readFileSync(
    new URL("../../components/marketplace-home/HomeIndex.tsx", import.meta.url),
    "utf8",
  );
  const parsed = ts.createSourceFile(
    "HomeIndex.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const selected = parsed.statements.filter(
    (statement) =>
      (ts.isFunctionDeclaration(statement) &&
        ["toDemo", "CuratedRow"].includes(statement.name?.text ?? "")) ||
      (ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.some(
          (declaration) =>
            ts.isIdentifier(declaration.name) && declaration.name.text === "CARD_COLORS",
        )),
  );
  expect(selected).toHaveLength(3);
  const output = ts.transpileModule(
    selected.map((statement) => statement.getText(parsed)).join("\n") + "\nexport { CuratedRow };",
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const exports: Record<string, unknown> = {};
  const cards: Record<string, unknown>[] = [];
  const DemoCard = (props: Record<string, unknown>) => {
    cards.push(props);
    return null;
  };
  const jsx = (component: unknown, props: Record<string, unknown>) =>
    typeof component === "function" ? component(props) : props;
  runInNewContext(output, {
    exports,
    Package: () => null,
    LIFETIME_PRICE: "unchanged-price",
    DemoCard,
    CategoryRow: (props: unknown) => props,
    useMemo: (run: () => unknown) => run(),
    useHomeRouteData: () => ({ seed: { rows } }),
    require: (name: string) => {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      throw new Error(`Unexpected curated-row dependency: ${name}`);
    },
  });
  const render = exports.CuratedRow;
  if (typeof render !== "function") throw new Error("CuratedRow missing");
  const favorites: string[] = [];
  const toggled: string[] = [];
  const result: unknown = render({
    rowKey: "featured",
    title: "Featured",
    limit: 2,
    favorites,
    onToggleFavorite: (id: string) => toggled.push(id),
  });
  return { cards, result, toggled };
}
const card = (id: string, hasDemo: boolean) => ({
  id,
  slug: id,
  name: id,
  href: `/software/${id}`,
  industry: "Retail",
  subcategory: "POS",
  description: "Actual catalogue copy",
  country: "India",
  hasDemo,
  features: ["Inventory"],
  tech: ["React"],
  rating: 4,
  license: "Commercial",
  platform: "Web",
});

describe("curated catalogue row mapping", () => {
  it("uses the existing converter, preserves order/limit and leaves the seed untouched", () => {
    const rows = [
      { id: "featured", cards: [card("first", true), card("second", false), card("third", true)] },
    ];
    const before = JSON.stringify(rows);
    const f = fixture(rows);
    expect(f.cards.map((props) => props.index)).toEqual([0, 1]);
    expect(f.cards.map((props) => props.demo)).toMatchObject([
      {
        id: "first",
        url: "/software/first",
        category: "POS",
        masterCategory: "Retail",
        status: "ACTIVE",
        features: ["Inventory"],
        frontend: ["React"],
      },
      { id: "second", url: "/software/second", status: "LISTED", hasDemo: false },
    ]);
    expect(JSON.stringify(rows)).toBe(before);
    const toggle = f.cards[0].onToggleFavorite;
    if (typeof toggle !== "function") throw new Error("Favorite callback missing");
    toggle();
    expect(f.toggled).toEqual(["first"]);
  });

  it("matches a published row by slug without substituting unrelated cards", () => {
    const f = fixture([
      { id: "other", cards: [card("unrelated", true)] },
      { slug: "featured", cards: [card("picked", true)] },
    ]);
    expect(f.cards.map((props) => props.demo)).toMatchObject([{ id: "picked" }]);
  });

  it.each(
    [[], [{ id: "other", cards: [card("unrelated", true)] }], [{ id: "featured", cards: [] }]].map(
      (rows) => ({ rows }),
    ),
  )("does not invent a rail when the selected row is absent or empty: %j", ({ rows }) => {
    const f = fixture(rows);
    expect(f.result).toBeNull();
    expect(f.cards).toEqual([]);
  });
});
