import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Lock, FileDown, Filter } from 'lucide-react';
import { toast } from 'sonner';

import { useLegalLogs, useLogAction } from '@/lib/legal-data';
import { motion } from 'framer-motion';

interface LegalLog {
  id: string;
  timestamp: string;
  action: string;
  category: 'policy' | 'trademark' | 'violation' | 'document' | 'escalation' | 'ai_flag';
  actor: string;
  details: string;
  immutable: boolean;
}


const LMLegalLogs: React.FC = () => {
  const { data: logRows = [] } = useLegalLogs();
  const logAction = useLogAction();
  const [filterActive, setFilterActive] = useState(false);

  const logs: LegalLog[] = logRows.map((row) => ({
    id: row.ref_code,
    timestamp: row.logged_at,
    action: row.action,
    category: row.category as LegalLog['category'],
    actor: row.actor,
    details: row.details,
    immutable: row.immutable,
  }));

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'policy': return 'bg-blue-500/20 text-blue-400';
      case 'trademark': return 'bg-purple-500/20 text-purple-400';
      case 'violation': return 'bg-red-500/20 text-red-400';
      case 'document': return 'bg-green-500/20 text-green-400';
      case 'escalation': return 'bg-orange-500/20 text-orange-400';
      case 'ai_flag': return 'bg-cyan-500/20 text-cyan-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const visibleLogs = useMemo(
    () => filterActive ? logs.filter((log) => ['violation', 'escalation', 'ai_flag'].includes(log.category)) : logs,
    [filterActive, logs],
  );

  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      pdf.setFontSize(16);
      pdf.text('Software Vala — Legal Activity Logs', 40, 44);
      pdf.setFontSize(9);
      let y = 70;
      for (const log of visibleLogs) {
        const lines = pdf.splitTextToSize(
          `${new Date(log.timestamp).toLocaleString()} | ${log.id} | ${log.category}\n${log.action} — ${log.details} (${log.actor})`,
          515,
        );
        if (y + lines.length * 12 > 790) {
          pdf.addPage();
          y = 40;
        }
        pdf.text(lines, 40, y);
        y += lines.length * 12 + 10;
      }
      pdf.save(`legal-activity-${new Date().toISOString().slice(0, 10)}.pdf`);
      logAction.mutate({
        action: 'Legal Log Exported',
        category: 'audit',
        actor: 'LM-A1B2',
        details: `${visibleLogs.length} legal activity entries exported to PDF`,
      });
      toast.success('Legal logs exported to PDF');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to export legal logs');
    }
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Legal Activity Logs
          <Badge variant="outline" className="ml-2 gap-1">
            <Lock className="h-3 w-3" />
            Immutable
          </Badge>
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant={filterActive ? 'secondary' : 'outline'} className="gap-1" onClick={() => setFilterActive((value) => !value)}>
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button size="sm" variant="secondary" onClick={handleExportPDF} className="gap-1">
            <FileDown className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {visibleLogs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-3 rounded-lg bg-background/50 border border-border/50 hover:border-primary/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{log.id}</span>
                      <Badge className={getCategoryColor(log.category)}>
                        {log.category.replace('_', ' ')}
                      </Badge>
                      {log.immutable && (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <p className="font-medium text-sm">{log.action}</p>
                    <p className="text-sm text-muted-foreground">{log.details}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    <p>{new Date(log.timestamp).toLocaleDateString()}</p>
                    <p>{new Date(log.timestamp).toLocaleTimeString()}</p>
                    <p className="mt-1 font-mono">{log.actor}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-4 p-3 rounded bg-muted/30 border border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            All logs are append-only and immutable. Export available in PDF format only.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LMLegalLogs;
