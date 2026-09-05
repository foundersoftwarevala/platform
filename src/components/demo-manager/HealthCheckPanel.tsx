import { useHealthCheck } from "@/hooks/useHealthCheck";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, XCircle, AlertTriangle, Loader2, Zap, Sparkles, Shield, Timer, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const HealthCheckPanel = () => {
  const {
    isChecking,
    progress,
    totalBatches,
    currentBatch,
    results,
    summary,
    runHealthCheck,
  } = useHealthCheck();

  const handleRunCheck = () => {
    runHealthCheck(undefined, 50);
  };

  return (
    <div className="space-y-6">
      {/* Main Health Check Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-800/40 border-slate-700/50 backdrop-blur-xl overflow-hidden relative">
          {/* Background Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/10 to-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl" />
          
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div 
                  className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center shadow-lg shadow-cyan-500/25"
                  animate={isChecking ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 1, repeat: isChecking ? Infinity : 0 }}
                >
                  <Activity className="h-6 w-6 text-white" />
                </motion.div>
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    Batch Health Check
                    {isChecking && (
                      <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 animate-pulse">
                        Running
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Check all demo URLs at once with parallel processing
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-slate-400">
                <Timer className="w-4 h-4" />
                <span className="text-sm">~30s for 500 demos</span>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6 relative">
            {/* Action Button */}
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button 
                onClick={handleRunCheck} 
                disabled={isChecking}
                size="lg"
                className={`w-full h-14 text-lg font-semibold transition-all duration-300 ${
                  isChecking 
                    ? 'bg-slate-800 border-slate-700' 
                    : 'bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40'
                }`}
              >
                {isChecking ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Checking Batch {currentBatch} of {totalBatches}</span>
                    <ArrowRight className="w-4 h-4 animate-pulse" />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5" />
                    <span>Run Health Check</span>
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}
              </Button>
            </motion.div>

            {/* Progress Section */}
            <AnimatePresence>
              {isChecking && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                      Processing demos...
                    </span>
                    <span className="text-cyan-400 font-mono font-bold">{progress}%</span>
                  </div>
                  <div className="relative">
                    <Progress value={progress} className="h-3 bg-slate-800" />
                    <motion.div
                      className="absolute top-0 left-0 h-3 bg-gradient-to-r from-cyan-500/50 to-violet-500/50 rounded-full blur-sm"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Batch {currentBatch}/{totalBatches}</span>
                    <span>{Math.round(progress * 5)} / 500 demos checked</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Summary Cards */}
            <AnimatePresence>
              {summary && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4"
                >
                  {/* Total */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden group hover:border-slate-600/50 transition-all">
                      <CardContent className="p-4 relative">
                        <div className="absolute -top-6 -right-6 w-16 h-16 bg-slate-600/20 rounded-full blur-xl group-hover:bg-slate-500/30 transition-colors" />
                        <div className="flex items-center justify-between relative">
                          <div>
                            <span className="text-xs text-slate-400">Total</span>
                            <p className="text-2xl font-bold text-white">{summary.total}</p>
                          </div>
                          <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-slate-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                  
                  {/* Healthy */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Card className="bg-emerald-500/10 border-emerald-500/20 overflow-hidden group hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
                      <CardContent className="p-4 relative">
                        <div className="absolute -top-6 -right-6 w-16 h-16 bg-emerald-500/20 rounded-full blur-xl group-hover:bg-emerald-500/30 transition-colors" />
                        <div className="flex items-center justify-between relative">
                          <div>
                            <span className="text-xs text-emerald-400/80">Healthy</span>
                            <p className="text-2xl font-bold text-emerald-400">{summary.healthy}</p>
                          </div>
                          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                  
                  {/* Unhealthy */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Card className="bg-amber-500/10 border-amber-500/20 overflow-hidden group hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all">
                      <CardContent className="p-4 relative">
                        <div className="absolute -top-6 -right-6 w-16 h-16 bg-amber-500/20 rounded-full blur-xl group-hover:bg-amber-500/30 transition-colors" />
                        <div className="flex items-center justify-between relative">
                          <div>
                            <span className="text-xs text-amber-400/80">Unhealthy</span>
                            <p className="text-2xl font-bold text-amber-400">{summary.unhealthy}</p>
                          </div>
                          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                  
                  {/* Errors */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Card className="bg-red-500/10 border-red-500/20 overflow-hidden group hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/10 transition-all">
                      <CardContent className="p-4 relative">
                        <div className="absolute -top-6 -right-6 w-16 h-16 bg-red-500/20 rounded-full blur-xl group-hover:bg-red-500/30 transition-colors" />
                        <div className="flex items-center justify-between relative">
                          <div>
                            <span className="text-xs text-red-400/80">Errors</span>
                            <p className="text-2xl font-bold text-red-400">{summary.error}</p>
                          </div>
                          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                            <XCircle className="w-5 h-5 text-red-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results List */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Detailed Results
                  <Badge variant="outline" className="ml-2 text-slate-400 border-slate-600">
                    {results.length} demos
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                  {results.slice(0, 20).map((result, index) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={`p-3 rounded-lg flex items-center justify-between group transition-all ${
                        result.status === 'healthy' 
                          ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10' 
                          : result.status === 'unhealthy'
                          ? 'bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10'
                          : 'bg-red-500/5 hover:bg-red-500/10 border border-red-500/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {result.status === 'healthy' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : result.status === 'unhealthy' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-white">{result.id}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[300px]">{result.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.response_time_ms && (
                          <span className="text-xs text-slate-400 font-mono">{result.response_time_ms}ms</span>
                        )}
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            result.status === 'healthy' 
                              ? 'text-emerald-400 border-emerald-500/30' 
                              : result.status === 'unhealthy'
                              ? 'text-amber-400 border-amber-500/30'
                              : 'text-red-400 border-red-500/30'
                          }`}
                        >
                          {result.http_status || 'N/A'}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                  {results.length > 20 && (
                    <p className="text-center text-sm text-slate-500 pt-2">
                      ... and {results.length - 20} more results
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HealthCheckPanel;
