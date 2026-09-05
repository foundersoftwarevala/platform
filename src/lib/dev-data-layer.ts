/**
 * Development Mode Data Layer
 * Provides complete CRUD operations using localStorage when Supabase is unavailable
 * Enables full E2E testing of Reseller ecosystem
 */

interface DevRecord {
  id: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

class DevDataLayer {
  private prefix = "dev_db_";

  private getKey(table: string): string {
    return `${this.prefix}${table}`;
  }

  private getTable(table: string): DevRecord[] {
    try {
      const stored = localStorage.getItem(this.getKey(table));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveTable(table: string, data: DevRecord[]): void {
    try {
      localStorage.setItem(this.getKey(table), JSON.stringify(data));
    } catch (e) {
      console.error(`[DevDB] Failed to save ${table}:`, e);
    }
  }

  // Generic CRUD
  insert(table: string, record: Partial<DevRecord>): DevRecord {
    const data = this.getTable(table);
    const now = new Date().toISOString();
    const newRecord: DevRecord = {
      id: record.id || `${table}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: record.created_at || now,
      updated_at: record.updated_at || now,
      ...record,
    };
    data.push(newRecord);
    this.saveTable(table, data);
    console.log(`[DevDB] Inserted into ${table}:`, newRecord.id);
    return newRecord;
  }

  select(table: string, where?: Record<string, any>): DevRecord[] {
    let data = this.getTable(table);
    if (where) {
      data = data.filter((row) => {
        for (const [key, value] of Object.entries(where)) {
          if (row[key] !== value) return false;
        }
        return true;
      });
    }
    return data;
  }

  selectOne(table: string, id: string): DevRecord | null {
    const data = this.getTable(table);
    return data.find((r) => r.id === id) || null;
  }

  update(table: string, id: string, updates: Partial<DevRecord>): DevRecord | null {
    const data = this.getTable(table);
    const index = data.findIndex((r) => r.id === id);
    if (index === -1) return null;

    data[index] = {
      ...data[index],
      ...updates,
      id, // Don't allow changing ID
      updated_at: new Date().toISOString(),
    };
    this.saveTable(table, data);
    console.log(`[DevDB] Updated ${table}:`, id);
    return data[index];
  }

  delete(table: string, id: string): boolean {
    const data = this.getTable(table);
    const index = data.findIndex((r) => r.id === id);
    if (index === -1) return false;
    data.splice(index, 1);
    this.saveTable(table, data);
    console.log(`[DevDB] Deleted from ${table}:`, id);
    return true;
  }

  count(table: string, where?: Record<string, any>): number {
    return this.select(table, where).length;
  }

  clear(): void {
    for (const key in localStorage) {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    }
    console.log("[DevDB] Cleared all dev data");
  }

  // Seed with initial QA data
  seed(): void {
    console.log("[DevDB] Seeding with QA data...");

    // Users
    this.insert("users", {
      id: "qa-admin-123",
      email: "qa.admin@example.com",
      name: "QA Admin",
      role: "admin",
    });

    this.insert("users", {
      id: "qa-reseller-a-456",
      email: "qa.reseller.a@example.com",
      name: "QA Reseller A",
      role: "reseller",
    });

    this.insert("users", {
      id: "qa-reseller-b-789",
      email: "qa.reseller.b@example.com",
      name: "QA Reseller B",
      role: "reseller",
    });

    // Reseller Applications (1 approved, 1 pending)
    this.insert("reseller_applications", {
      id: "app-approved-001",
      requester_name: "John Doe",
      requester_email: "qa.reseller.a@example.com",
      company_name: "QA Tech Solutions",
      region: "North America",
      motivation: "Want to sell enterprise software",
      status: "approved",
      application_type: "new",
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    this.insert("reseller_applications", {
      id: "app-pending-001",
      requester_name: "Jane Smith",
      requester_email: "qa.reseller.b@example.com",
      company_name: "Global Solutions Ltd",
      region: "Europe",
      motivation: "Expand into EMEA region",
      status: "pending",
      application_type: "new",
    });

    // Resellers
    this.insert("resellers", {
      id: "reseller-qa-a-001",
      user_id: "qa-reseller-a-456",
      name: "QA Tech Solutions Inc",
      email: "qa.reseller.a@example.com",
      status: "active",
      tier: "gold",
      region: "North America",
    });

    // Customers
    const customers = [
      {
        id: "cust-001",
        reseller_id: "reseller-qa-a-001",
        name: "Acme Corporation",
        email: "contact@acme.com",
        company: "Acme Corp",
        segment: "enterprise",
        status: "active",
      },
      {
        id: "cust-002",
        reseller_id: "reseller-qa-a-001",
        name: "TechStart Inc",
        email: "contact@techstart.com",
        company: "TechStart",
        segment: "sme",
        status: "active",
      },
    ];

    for (const cust of customers) {
      this.insert("reseller_customers", cust);
    }

    // Products
    const products = [
      {
        id: "prod-001",
        name: "School Management System",
        sku: "SMS-001",
        category: "Software",
        price: 59999,
        status: "active",
      },
      {
        id: "prod-002",
        name: "Sales CRM Pro",
        sku: "CRM-001",
        category: "Software",
        price: 74999,
        status: "active",
      },
    ];

    for (const prod of products) {
      this.insert("reseller_products", prod);
    }

    // Orders
    const orders = [
      {
        id: "order-001",
        reseller_id: "reseller-qa-a-001",
        customer_id: "cust-001",
        product: "School Management System",
        qty: 1,
        amount: 59999,
        status: "pending",
        payment: "unpaid",
        ref: "ORD-QA-00001",
      },
      {
        id: "order-002",
        reseller_id: "reseller-qa-a-001",
        customer_id: "cust-002",
        product: "Sales CRM Pro",
        qty: 2,
        amount: 149998,
        status: "fulfilled",
        payment: "paid",
        ref: "ORD-QA-00002",
      },
    ];

    for (const order of orders) {
      this.insert("reseller_orders", order);
    }

    // Licenses
    this.insert("reseller_licenses", {
      id: "lic-001",
      reseller_id: "reseller-qa-a-001",
      license_key: "SV-QA-20260817-000001",
      product: "School Management System",
      customer_name: "Acme Corporation",
      status: "active",
      plan: "pro",
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Commissions
    this.insert("reseller_commissions", {
      id: "comm-001",
      name: "Gold Tier Commission",
      tier: "gold",
      rate: 20,
      scope: "sales",
      status: "active",
    });

    // Wallet Transactions
    this.insert("reseller_wallet_transactions", {
      id: "txn-001",
      reseller_id: "reseller-qa-a-001",
      type: "commission",
      amount: 11999,
      status: "completed",
      ref: "TXN-QA-001",
      note: "Commission on order ORD-QA-00001",
    });

    console.log("[DevDB] QA seed complete");
  }
}

export const devDB = new DevDataLayer();

// Auto-seed on first load
if (typeof window !== "undefined") {
  if (!localStorage.getItem("dev_db_seeded")) {
    devDB.seed();
    localStorage.setItem("dev_db_seeded", "true");
  }
}
