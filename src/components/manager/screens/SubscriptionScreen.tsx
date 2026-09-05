import { useState } from "react";
import {
  CreditCard,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  Download,
  Tag,
  Clock,
  DollarSign,
  Users,
  Settings,
} from "lucide-react";
import { PageHeader, GlassCard, StatCard, StatusBadge } from "../primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function SubscriptionScreen() {
  const [subscriptions, setSubscriptions] = useState<any[]>([
    {
      id: 1,
      user: "john@example.com",
      plan: "Pro",
      price: "$99/month",
      status: "active",
      nextBilling: "2026-09-15",
    },
    {
      id: 2,
      user: "sarah@example.com",
      plan: "Enterprise",
      price: "$499/month",
      status: "active",
      nextBilling: "2026-09-20",
    },
    {
      id: 3,
      user: "mike@example.com",
      plan: "Starter",
      price: "$29/month",
      status: "cancelled",
      nextBilling: "N/A",
    },
  ]);

  const [invoices, setInvoices] = useState<any[]>([
    {
      id: "INV-001",
      user: "john@example.com",
      amount: "$99.00",
      date: "2026-08-15",
      status: "paid",
    },
    {
      id: "INV-002",
      user: "sarah@example.com",
      amount: "$499.00",
      date: "2026-08-20",
      status: "paid",
    },
  ]);

  const [coupons, setCoupons] = useState<any[]>([
    { id: 1, code: "SUMMER50", discount: "50%", uses: 24, limit: 100, active: true },
    { id: 2, code: "REFERRAL20", discount: "20%", uses: 156, limit: 500, active: true },
  ]);

  const stats = [
    { label: "Active Subscriptions", value: 247, tone: "primary" },
    { label: "MRR", value: "$12,450", tone: "green" },
    { label: "Churn Rate", value: "2.1%", tone: "amber" },
    { label: "ARPU", value: "$50.4", tone: "cyan" },
  ];

  return (
    <>
      <PageHeader
        title="Subscriptions & Payments"
        description="Manage plans, payments, invoices, and billing"
      />

      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <StatCard
              key={i}
              label={s.label}
              value={s.value}
              tone={s.tone as any}
              icon={
                [
                  <Users className="h-4 w-4" />,
                  <DollarSign className="h-4 w-4" />,
                  <X className="h-4 w-4" />,
                  <CreditCard className="h-4 w-4" />,
                ][i]
              }
            />
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="subscriptions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="subscriptions">
              <Users className="mr-2 h-4 w-4" /> Subscriptions
            </TabsTrigger>
            <TabsTrigger value="plans">
              <CreditCard className="mr-2 h-4 w-4" /> Plans
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <DollarSign className="mr-2 h-4 w-4" /> Invoices
            </TabsTrigger>
            <TabsTrigger value="coupons">
              <Tag className="mr-2 h-4 w-4" /> Coupons
            </TabsTrigger>
            <TabsTrigger value="payments">
              <CreditCard className="mr-2 h-4 w-4" /> Payment Methods
            </TabsTrigger>
            <TabsTrigger value="stripe">
              <Settings className="mr-2 h-4 w-4" /> Stripe
            </TabsTrigger>
          </TabsList>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions">
            <GlassCard title="Active Subscriptions">
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead className="text-right">Next Billing</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium">{sub.user}</TableCell>
                          <TableCell>{sub.plan}</TableCell>
                          <TableCell>{sub.price}</TableCell>
                          <TableCell className="text-right">{sub.nextBilling}</TableCell>
                          <TableCell>
                            <StatusBadge value={sub.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <button className="text-muted-foreground hover:text-foreground">
                                <Edit className="h-4 w-4" />
                              </button>
                              <button className="text-muted-foreground hover:text-foreground">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans">
            <GlassCard
              title="Subscription Plans"
              actions={
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> New Plan
                </Button>
              }
            >
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { name: "Starter", price: "$29", features: 5 },
                  { name: "Pro", price: "$99", features: 15 },
                  { name: "Enterprise", price: "Custom", features: "All" },
                ].map((plan) => (
                  <div
                    key={plan.name}
                    className="rounded-lg border border-border p-6 text-center"
                  >
                    <p className="font-bold">{plan.name}</p>
                    <p className="text-2xl font-bold text-primary">{plan.price}</p>
                    <p className="text-sm text-muted-foreground">/month</p>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1">
                        Edit
                      </Button>
                      <Button size="sm" className="flex-1">
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <GlassCard title="Billing History">
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono">{inv.id}</TableCell>
                          <TableCell>{inv.user}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {inv.amount}
                          </TableCell>
                          <TableCell>{inv.date}</TableCell>
                          <TableCell>
                            <StatusBadge value={inv.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <button className="text-primary hover:underline flex items-center gap-1">
                              <Download className="h-4 w-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Coupons Tab */}
          <TabsContent value="coupons">
            <GlassCard
              title="Discount Coupons"
              actions={
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> New Coupon
                </Button>
              }
            >
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead className="text-right">Used</TableHead>
                        <TableHead className="text-right">Limit</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coupons.map((coupon) => (
                        <TableRow key={coupon.id}>
                          <TableCell className="font-mono">{coupon.code}</TableCell>
                          <TableCell className="font-bold text-status-success">
                            {coupon.discount}
                          </TableCell>
                          <TableCell className="text-right">{coupon.uses}</TableCell>
                          <TableCell className="text-right">{coupon.limit}</TableCell>
                          <TableCell>
                            {coupon.active ? (
                              <Check className="h-4 w-4 text-status-success" />
                            ) : (
                              <X className="h-4 w-4 text-status-error" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <button className="text-muted-foreground hover:text-foreground">
                                <Edit className="h-4 w-4" />
                              </button>
                              <button className="text-muted-foreground hover:text-foreground">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Payment Methods Tab */}
          <TabsContent value="payments">
            <GlassCard title="Payment Methods">
              <div className="space-y-4">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Add Payment Method
                </Button>
                <div className="rounded-lg border border-border p-4">
                  <p className="font-medium">Visa •••• 4242</p>
                  <p className="text-sm text-muted-foreground">Expires 12/2028</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive">
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Stripe Tab */}
          <TabsContent value="stripe">
            <GlassCard title="Stripe Connection">
              <div className="space-y-4">
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm font-medium">Status: Connected</p>
                  <p className="text-sm text-muted-foreground">
                    Account: sk_live_xxx (Live Mode)
                  </p>
                </div>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full">
                    View Stripe Dashboard
                  </Button>
                  <Button variant="outline" className="w-full">
                    Reconnect Account
                  </Button>
                </div>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
