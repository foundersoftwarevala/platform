import { createFileRoute } from "@tanstack/react-router";
import ProductDemoManagerPage from "@/pages/product-demo-manager";

export const Route = createFileRoute("/product-demo-manager")({
  head: () => ({
    meta: [
      { title: "Product & Demo Studio — Software Vala" },
      {
        name: "description",
        content:
          "Software Vala product and demo studio: product catalog, demo registry, bulk add, analytics, audit logs and health checks.",
      },
      { property: "og:title", content: "Product & Demo Studio — Software Vala" },
      {
        property: "og:description",
        content: "Manage products, demos, bulk imports, analytics, audit logs and demo health checks.",
      },
    ],
  }),
  component: ProductDemoManagerPage,
});