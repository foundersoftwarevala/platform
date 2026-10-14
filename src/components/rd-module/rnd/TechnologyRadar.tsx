import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/rd-module/ui/card";
import { Button } from "@/components/rd-module/ui/button";
import { Badge } from "@/components/rd-module/ui/badge";
import { ScrollArea } from "@/components/rd-module/ui/scroll-area";
import { useRnDAI } from "@/hooks/rd-module/useRnDAI";
import { useTechnologies } from "@/hooks/rd-module/useRnDData";
import {
  Radar,
  Brain,
  RefreshCw,
  Loader2,
  Code,
  Database,
  Cloud,
  Cpu,
  Layers,
  Terminal,
  Zap,
  Shield,
} from "lucide-react";

export const TechnologyRadar = () => {
  const { data: technologiesData } = useTechnologies();
  const technologies = technologiesData ?? [];
  const [selectedRing, setSelectedRing] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  const { isLoading, createTechnologyRadar } = useRnDAI();

  const rings = [
    { id: "adopt", label: "ADOPT", color: "emerald", description: "Ready for production" },
    { id: "trial", label: "TRIAL", color: "blue", description: "Worth pursuing in pilots" },
    { id: "assess", label: "ASSESS", color: "amber", description: "Worth exploring" },
    { id: "hold", label: "HOLD", color: "red", description: "Proceed with caution" },
  ];

  const categories = [
    { id: "languages", label: "Languages", icon: Code },
    { id: "frameworks", label: "Frameworks", icon: Layers },
    { id: "tools", label: "Tools", icon: Terminal },
    { id: "platforms", label: "Platforms", icon: Cloud },
    { id: "techniques", label: "Techniques", icon: Cpu },
    { id: "infrastructure", label: "Infrastructure", icon: Database },
  ];

  const handleRefreshRadar = async () => {
    const response = await createTechnologyRadar("Software Development", "2 years");
    if (response) {
      setAiInsight(response);
    }
  };

  const filteredTechs = technologies.filter((tech) => {
    if (selectedRing && tech.ring !== selectedRing) return false;
    if (selectedCategory && tech.category !== selectedCategory) return false;
    return true;
  });

  const getRingColor = (ring: string) => {
    switch (ring) {
      case "adopt":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "trial":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "assess":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "hold":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find((c) => c.id === category);
    return cat?.icon || Cpu;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-600/30 to-blue-600/30 border border-cyan-500/30">
            <Radar className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Technology Radar
            </h2>
            <p className="text-slate-400 text-sm">
              AI-powered technology assessment and recommendations
            </p>
          </div>
        </div>
        <Button
          onClick={handleRefreshRadar}
          disabled={isLoading}
          className="bg-gradient-to-r from-cyan-600 to-blue-600"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          AI Refresh
        </Button>
      </motion.div>

      {/* Ring Legend */}
      <div className="grid grid-cols-4 gap-4">
        {rings.map((ring) => (
          <motion.button
            key={ring.id}
            onClick={() => setSelectedRing(selectedRing === ring.id ? null : ring.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              className={`p-4 text-center transition-all ${
                selectedRing === ring.id
                  ? getRingColor(ring.id)
                  : "bg-slate-900/50 border-slate-700 hover:border-slate-600"
              }`}
            >
              <p className={`text-lg font-bold ${selectedRing === ring.id ? "" : "text-white"}`}>
                {ring.label}
              </p>
              <p className="text-xs text-slate-500">{ring.description}</p>
              <p className="text-2xl font-bold mt-2 text-white">
                {technologies.filter((t) => t.ring === ring.id).length}
              </p>
            </Card>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left - Categories Filter */}
        <div className="col-span-3">
          <Card className="bg-slate-900/50 border-violet-500/20 p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-4">Categories</h3>
            <div className="space-y-2">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const count = technologies.filter((t) => t.category === cat.id).length;
                return (
                  <motion.button
                    key={cat.id}
                    onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                      selectedCategory === cat.id
                        ? "bg-violet-600/20 text-white border border-violet-500/50"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }`}
                    whileHover={{ x: 5 }}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{cat.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {count}
                    </Badge>
                  </motion.button>
                );
              })}
            </div>

            {(selectedRing || selectedCategory) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedRing(null);
                  setSelectedCategory(null);
                }}
                className="w-full mt-4 text-slate-500"
              >
                Clear Filters
              </Button>
            )}
          </Card>
        </div>

        {/* Center - Radar Visualization */}
        <div className="col-span-5">
          <Card className="bg-slate-900/50 border-violet-500/20 p-6">
            {/* Visual Radar */}
            <div className="relative w-full aspect-square max-w-[400px] mx-auto">
              {/* Rings */}
              {[0.9, 0.7, 0.5, 0.3].map((scale, idx) => (
                <div
                  key={idx}
                  className="absolute inset-0 rounded-full border border-slate-700/50"
                  style={{
                    transform: `scale(${scale})`,
                    top: `${(1 - scale) * 50}%`,
                    left: `${(1 - scale) * 50}%`,
                    width: `${scale * 100}%`,
                    height: `${scale * 100}%`,
                  }}
                />
              ))}

              {/* Ring Labels */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                <p className="text-xs text-slate-600">HOLD</p>
              </div>

              {/* Technology Dots */}
              {filteredTechs.map((tech, idx) => {
                const ringDistance =
                  (
                    { adopt: 0.85, trial: 0.65, assess: 0.45, hold: 0.25 } as Record<string, number>
                  )[tech.ring] ?? 0.45;

                const angle = (idx / filteredTechs.length) * 360;
                const x = 50 + ringDistance * 40 * Math.cos((angle * Math.PI) / 180);
                const y = 50 + ringDistance * 40 * Math.sin((angle * Math.PI) / 180);

                return (
                  <motion.div
                    key={tech.id}
                    className={`absolute w-4 h-4 rounded-full cursor-pointer ${
                      tech.ring === "adopt"
                        ? "bg-emerald-400"
                        : tech.ring === "trial"
                          ? "bg-blue-400"
                          : tech.ring === "assess"
                            ? "bg-amber-400"
                            : "bg-red-400"
                    }`}
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.5 }}
                    title={tech.name}
                  />
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right - Technology List */}
        <div className="col-span-4">
          <Card className="bg-slate-900/50 border-violet-500/20 p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-4">
              Technologies ({filteredTechs.length})
            </h3>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {filteredTechs.map((tech, idx) => {
                  const Icon = getCategoryIcon(tech.category);
                  return (
                    <motion.div
                      key={tech.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <Card className="bg-slate-800/50 border-slate-700 p-3">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${getRingColor(tech.ring)}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-white text-sm">{tech.name}</p>
                              <Badge className={`text-xs ${getRingColor(tech.ring)}`}>
                                {tech.ring.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{tech.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-violet-600 to-cyan-600"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${tech.relevance}%` }}
                                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                                />
                              </div>
                              <span className="text-xs text-slate-500">{tech.relevance}%</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>

      {/* AI Insight Panel */}
      {aiInsight && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-slate-900/50 border-violet-500/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-violet-400" />
              AI Technology Assessment
            </h3>
            <ScrollArea className="h-[300px]">
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{aiInsight}</p>
            </ScrollArea>
          </Card>
        </motion.div>
      )}
    </div>
  );
};
