import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Clock,
  Activity,
  CheckCircle,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { DemoReportCard as ReportCardType } from "@/hooks/useDemoManagerAccess";

interface DemoReportCardProps {
  reportCard: ReportCardType;
  onUpdateStatus?: (id: string, status: string) => void;
  showActions?: boolean;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  add: <Play className="w-4 h-4" />,
  edit: <RefreshCw className="w-4 h-4" />,
  delete: <AlertTriangle className="w-4 h-4" />,
  fix: <CheckCircle className="w-4 h-4" />,
  replace_link: <RefreshCw className="w-4 h-4" />,
  health_check: <Activity className="w-4 h-4" />,
  status_update: <Pause className="w-4 h-4" />,
  approve: <CheckCircle className="w-4 h-4" />,
  reject: <AlertTriangle className="w-4 h-4" />
};

const ACTION_COLORS: Record<string, string> = {
  add: 'bg-green-500/20 text-green-400 border-green-500/30',
  edit: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  delete: 'bg-red-500/20 text-red-400 border-red-500/30',
  fix: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  replace_link: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  health_check: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  status_update: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  approve: 'bg-green-500/20 text-green-400 border-green-500/30',
  reject: 'bg-red-500/20 text-red-400 border-red-500/30'
};

const WORKFLOW_COLORS: Record<string, string> = {
  submitted: 'bg-yellow-500/20 text-yellow-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  fixed: 'bg-emerald-500/20 text-emerald-400',
  live: 'bg-green-500/20 text-green-400',
  disabled: 'bg-gray-500/20 text-gray-400'
};

const UPTIME_COLORS: Record<string, string> = {
  online: 'text-green-400',
  degraded: 'text-yellow-400',
  offline: 'text-red-400',
  unknown: 'text-gray-400'
};

export function DemoReportCardItem({ reportCard, onUpdateStatus, showActions = true }: DemoReportCardProps) {
  const workflowSteps = ['submitted', 'in_progress', 'fixed', 'live'];
  const currentStep = workflowSteps.indexOf(reportCard.workflow_status);

  return (
    <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Main Info */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${ACTION_COLORS[reportCard.action_type]} flex items-center gap-1`}>
                {ACTION_ICONS[reportCard.action_type]}
                {reportCard.action_type.replace('_', ' ').toUpperCase()}
              </Badge>
              <Badge className={WORKFLOW_COLORS[reportCard.workflow_status]}>
                {reportCard.workflow_status.replace('_', ' ')}
              </Badge>
              {reportCard.auto_registered && (
                <Badge variant="outline" className="text-xs">Auto-Registered</Badge>
              )}
            </div>
            
            <h4 className="font-semibold text-foreground">{reportCard.demo_name}</h4>
            
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              {reportCard.sector && (
                <div>
                  <span className="text-xs uppercase tracking-wide">Sector:</span>
                  <span className="ml-1">{reportCard.sector}</span>
                </div>
              )}
              {reportCard.sub_category && (
                <div>
                  <span className="text-xs uppercase tracking-wide">Category:</span>
                  <span className="ml-1">{reportCard.sub_category}</span>
                </div>
              )}
              {reportCard.demo_status && (
                <div>
                  <span className="text-xs uppercase tracking-wide">Status:</span>
                  <span className="ml-1">{reportCard.demo_status}</span>
                </div>
              )}
              {reportCard.uptime_state && (
                <div>
                  <span className="text-xs uppercase tracking-wide">Uptime:</span>
                  <span className={`ml-1 ${UPTIME_COLORS[reportCard.uptime_state] || 'text-muted-foreground'}`}>
                    {reportCard.uptime_state}
                  </span>
                </div>
              )}
            </div>

            {(reportCard.error_details || reportCard.fix_details) && (
              <div className="mt-2 p-2 rounded bg-background/50 text-xs">
                {reportCard.error_details && (
                  <p className="text-red-400">
                    <span className="font-medium">Error:</span> {reportCard.error_details}
                  </p>
                )}
                {reportCard.fix_details && (
                  <p className="text-green-400 mt-1">
                    <span className="font-medium">Fix:</span> {reportCard.fix_details}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(reportCard.action_timestamp), 'MMM d, yyyy h:mm a')}
              </span>
              {reportCard.completion_time_seconds && (
                <span>Completed in {reportCard.completion_time_seconds}s</span>
              )}
            </div>
          </div>

          {/* Right: Workflow Progress & Actions */}
          {showActions && onUpdateStatus && (
            <div className="flex flex-col items-end gap-2">
              {/* Workflow Progress */}
              <div className="flex items-center gap-1">
                {workflowSteps.map((step, idx) => (
                  <div key={step} className="flex items-center">
                    <div 
                      className={`w-2 h-2 rounded-full ${
                        idx <= currentStep ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                    {idx < workflowSteps.length - 1 && (
                      <ChevronRight className={`w-3 h-3 ${
                        idx < currentStep ? 'text-primary' : 'text-muted'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              {reportCard.workflow_status !== 'live' && reportCard.workflow_status !== 'disabled' && (
                <div className="flex gap-1">
                  {reportCard.workflow_status === 'submitted' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onUpdateStatus(reportCard.id, 'in_progress')}
                    >
                      Start
                    </Button>
                  )}
                  {reportCard.workflow_status === 'in_progress' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onUpdateStatus(reportCard.id, 'fixed')}
                    >
                      Mark Fixed
                    </Button>
                  )}
                  {reportCard.workflow_status === 'fixed' && (
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => onUpdateStatus(reportCard.id, 'live')}
                    >
                      Go Live
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface DemoReportCardsListProps {
  reportCards: ReportCardType[];
  onUpdateStatus?: (id: string, status: string) => void;
  title?: string;
  maxHeight?: string;
  showActions?: boolean;
}

export function DemoReportCardsList({ 
  reportCards, 
  onUpdateStatus, 
  title = "Demo Report Cards",
  maxHeight = "500px",
  showActions = true
}: DemoReportCardsListProps) {
  return (
    <Card className="bg-card/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          {title}
          <Badge variant="outline" className="ml-2">{reportCards.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea style={{ maxHeight }}>
          <div className="space-y-3 pr-2">
            {reportCards.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No report cards yet
              </p>
            ) : (
              reportCards.map((card) => (
                <DemoReportCardItem
                  key={card.id}
                  reportCard={card}
                  onUpdateStatus={onUpdateStatus}
                  showActions={showActions}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
