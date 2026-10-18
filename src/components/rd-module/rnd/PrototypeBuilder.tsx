import { useState } from "react";
import { motion } from "framer-motion";
import {
  Blocks,
  Plus,
  Layers,
  GitBranch,
  Clock,
  Users,
  Eye,
  Play,
  Pause,
  ChevronRight,
  Cpu,
  Database,
  Globe,
  Shield,
} from "lucide-react";
import { Card } from "@/components/rd-module/ui/card";
import { Button } from "@/components/rd-module/ui/button";
import { Badge } from "@/components/rd-module/ui/badge";
import { Progress } from "@/components/rd-module/ui/progress";

const prototypes = [
  {
    id: "1",
    name: "Neural Code Assistant v2",
    modules: ["AI Engine", "Code Parser", "Suggestion API", "UI Widget"],
    progress: 78,
    estimatedHours: 120,
    completedHours: 94,
    team: ["vala(dev)4412", "vala(rnd)2341", "vala(ai)9981"],
    status: "active",
    integrations: ["VS Code", "GitHub", "Slack"],
  },
  {
    id: "2",
    name: "Holographic Dashboard",
    modules: ["3D Renderer", "Widget System", "Animation Engine"],
    progress: 45,
    estimatedHours: 200,
    completedHours: 90,
    team: ["vala(design)8892", "vala(dev)5523"],
    status: "active",
    integrations: ["React", "Three.js", "Framer"],
  },
  {
    id: "3",
    name: "Smart Deployment Pipeline",
    modules: ["CI/CD Core", "Test Runner", "Environment Manager", "Rollback System"],
    progress: 92,
    estimatedHours: 80,
    completedHours: 74,
    team: ["vala(devops)3341", "vala(dev)4412"],
    status: "testing",
    integrations: ["Docker", "K8s", "AWS"],
  },
];

const availableModules = [
  { id: "ai", name: "AI Engine", icon: Cpu, color: "violet" },
  { id: "db", name: "Database", icon: Database, color: "cyan" },
  { id: "api", name: "API Gateway", icon: Globe, color: "emerald" },
  { id: "auth", name: "Auth System", icon: Shield, color: "amber" },
];

export const PrototypeBuilder = () => {
  const [selectedPrototype, setSelectedPrototype] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            Prototype Builder
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Build and test feature prototypes with modular components
          </p>
        </div>
        <Button className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 gap-2">
          <Plus className="w-4 h-4" />
          New Prototype
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Module Palette */}
        <Card className="p-4 bg-slate-900/50 backdrop-blur-xl border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Blocks className="w-4 h-4 text-cyan-400" />
            Available Modules
          </h3>
          <div className="space-y-2">
            {availableModules.map((module) => {
              const Icon = module.icon;
              return (
                <motion.div
                  key={module.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 cursor-grab hover:border-cyan-500/50 transition-all"
                  whileHover={{ scale: 1.02, x: 5 }}
                  draggable
                  onDragStart={() => setIsDragging(true)}
                  onDragEnd={() => setIsDragging(false)}
                >
                  <div className={`p-2 rounded-lg bg-${module.color}-500/20`}>
                    <Icon className={`w-4 h-4 text-${module.color}-400`} />
                  </div>
                  <span className="text-sm text-slate-300">{module.name}</span>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 mb-2">Drag modules to prototype canvas</p>
            <div
              className={`h-24 rounded-lg border-2 border-dashed transition-all flex items-center justify-center ${
                isDragging ? "border-cyan-500/50 bg-cyan-500/10" : "border-slate-700/50"
              }`}
            >
              <span className="text-xs text-slate-500">Drop zone</span>
            </div>
          </div>
        </Card>

        {/* Active Prototypes */}
        <div className="col-span-2 space-y-4">
          {prototypes.map((prototype, index) => (
            <motion.div
              key={prototype.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={`p-5 bg-slate-900/50 backdrop-blur-xl border-slate-700/50 hover:border-cyan-500/30 transition-all ${
                  selectedPrototype === prototype.id ? "ring-2 ring-cyan-500/50" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{prototype.name}</h3>
                      <Badge
                        className={
                          prototype.status === "active"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-400"
                        }
                      >
                        {prototype.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {prototype.modules.length} modules
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {prototype.team.length} team members
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {prototype.completedHours}/{prototype.estimatedHours}h
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Eye className="w-4 h-4 text-slate-400" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      {prototype.status === "active" ? (
                        <Pause className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Play className="w-4 h-4 text-emerald-400" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Module Flow */}
                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                  {prototype.modules.map((module, i) => (
                    <div key={i} className="flex items-center">
                      <motion.div
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600/20 to-violet-600/20 border border-cyan-500/30 text-xs text-cyan-300 whitespace-nowrap"
                        whileHover={{ scale: 1.05 }}
                      >
                        {module}
                      </motion.div>
                      {i < prototype.modules.length - 1 && (
                        <ChevronRight className="w-4 h-4 text-slate-600 mx-1" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">Development Progress</span>
                    <span className="text-cyan-400 font-semibold">{prototype.progress}%</span>
                  </div>
                  <Progress value={prototype.progress} className="h-2 bg-slate-700" />
                </div>

                {/* Integrations */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Integrations:</span>
                  {prototype.integrations.map((int, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="bg-slate-800 text-slate-300 text-xs"
                    >
                      {int}
                    </Badge>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
