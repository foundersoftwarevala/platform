import { motion } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Card } from "@/components/rd-module/ui/card";
import { Progress } from "@/components/rd-module/ui/progress";

const transactions = [
  {
    id: "1",
    description: "AI Code Review - Phase 1",
    amount: -4500,
    type: "deduction",
    status: "completed",
    date: "Today",
  },
  {
    id: "2",
    description: "Prototype Builder License",
    amount: -2200,
    type: "deduction",
    status: "pending",
    date: "Yesterday",
  },
  {
    id: "3",
    description: "Q4 Budget Allocation",
    amount: 50000,
    type: "credit",
    status: "completed",
    date: "Dec 1",
  },
  {
    id: "4",
    description: "ROI Return - Deployment Pipeline",
    amount: 8500,
    type: "credit",
    status: "completed",
    date: "Nov 28",
  },
];

export const RnDWallet = () => {
  const totalBudget = 75000;
  const usedBudget = 21700;
  const availableBudget = totalBudget - usedBudget;
  const usagePercentage = (usedBudget / totalBudget) * 100;

  return (
    <Card className="p-4 bg-slate-900/50 backdrop-blur-xl border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-white">R&D Budget</h3>
        </div>
        <span className="text-xs text-slate-400">Q4 2024</span>
      </div>

      {/* Budget Overview */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-600/10 to-cyan-600/10 border border-emerald-500/20 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Available Budget</span>
          <motion.span
            className="text-2xl font-bold text-emerald-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            ${availableBudget.toLocaleString()}
          </motion.span>
        </div>
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500">Used: ${usedBudget.toLocaleString()}</span>
            <span className="text-slate-500">Total: ${totalBudget.toLocaleString()}</span>
          </div>
          <Progress value={usagePercentage} className="h-2 bg-slate-700" />
        </div>
        <p className="text-xs text-slate-400">
          {usagePercentage.toFixed(1)}% of quarterly budget utilized
        </p>
      </div>

      {/* ROI Projection */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <div className="flex items-center gap-1 text-emerald-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-semibold">+23%</span>
          </div>
          <p className="text-xs text-slate-400">Projected ROI</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <div className="flex items-center gap-1 text-cyan-400 mb-1">
            <ArrowUpRight className="w-4 h-4" />
            <span className="text-sm font-semibold">$18.5K</span>
          </div>
          <p className="text-xs text-slate-400">Expected Returns</p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="space-y-2">
        <p className="text-xs text-slate-400 mb-2">Recent Transactions</p>
        {transactions.map((tx, index) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div
                className={`p-1.5 rounded-lg ${
                  tx.type === "credit" ? "bg-emerald-500/20" : "bg-amber-500/20"
                }`}
              >
                {tx.type === "credit" ? (
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-amber-400" />
                )}
              </div>
              <div>
                <p className="text-xs text-white">{tx.description}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{tx.date}</span>
                  {tx.status === "pending" && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span
              className={`text-sm font-semibold ${
                tx.type === "credit" ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {tx.type === "credit" ? "+" : "-"}${Math.abs(tx.amount).toLocaleString()}
            </span>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};
