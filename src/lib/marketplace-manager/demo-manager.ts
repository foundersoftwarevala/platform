/**
 * Demo URL Manager - Real database-backed CRUD for product_demo_urls table
 * Wired to marketplace.functions server functions
 */

export type DemoUrl = {
  id: string;
  product_id: string;
  demo_name: string;
  role_name: string;
  status: "active" | "inactive";
  environment: "production" | "staging";
  url: string;
  username?: string | null;
  password?: string | null;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
};

// Import real server functions
import {
  addProductDemo as addProductDemoFn,
  updateProductDemo as updateProductDemoFn,
  deleteProductDemo as deleteProductDemoFn,
  listProductDemos as listProductDemosFn,
} from "@/lib/marketplace.functions";

// Re-export the real functions
export const addProductDemo = addProductDemoFn;
export const updateProductDemo = updateProductDemoFn;
export const deleteProductDemo = deleteProductDemoFn;
export const listProductDemos = listProductDemosFn;

// Types for queries
export type DemoUrlInput = Omit<DemoUrl, "id" | "created_at" | "updated_at">;
export type DemoUrlUpdate = Partial<Omit<DemoUrl, "id" | "created_at" | "updated_at">>;
