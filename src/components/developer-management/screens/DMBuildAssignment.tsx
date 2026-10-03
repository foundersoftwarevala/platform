/**
 * BUILD ASSIGNMENT
 * Build ID • Module Scope • Assigned Dev • Status
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Hammer, Play, Square, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation, type Translate } from '@/lib/i18n/use-translation';

/**
 * Builds. Four builds were typed in here, and Start, Stop and Send to QA only
 * showed messages. No build pipeline is connected to developer work, so the
 * queue says so; a build's start and stop would come from that pipeline.
 */
const builds: { id: string; module: string; assignee: string | null; status: string; started: string | null }[] = [];

const getStatusBadge = (status: string, t: Translate) => {
  switch (status) {
    case 'pending': return <Badge variant="secondary">{t('devmanager.status.pending')}</Badge>;
    case 'in_progress': return <Badge className="bg-blue-500/20 text-blue-500">{t('devmanager.status.in_progress')}</Badge>;
    case 'completed': return <Badge className="bg-green-500/20 text-green-500">{t('devmanager.status.completed')}</Badge>;
    case 'failed': return <Badge variant="destructive">{t('devmanager.builds.status_failed')}</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

export const DMBuildAssignment: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.builds.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.builds.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Hammer className="h-5 w-5" />
            {t('devmanager.builds.queue')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {builds.length === 0 && (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                {t('devmanager.builds.empty')}
              </p>
            )}
            {builds.map((build) => (
              <div
                key={build.id}
                className={`p-4 rounded-lg border ${
                  build.status === 'failed' ? 'bg-red-500/5 border-red-500/30' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium">{build.id}</span>
                    {getStatusBadge(build.status, t)}
                  </div>
                  {build.assignee && (
                    <span className="font-mono text-sm">{build.assignee}</span>
                  )}
                </div>
                <div className="mb-3">
                  <p className="font-medium">{build.module}</p>
                  {build.started && (
                    <p className="text-xs text-muted-foreground">{t('devmanager.builds.started', { time: build.started })}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => toast.success(t('devmanager.builds.started_toast', { id: build.id }))}
                    disabled={build.status === 'in_progress'}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    {t('devmanager.builds.start')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => toast.warning(t('devmanager.builds.stopped_toast', { id: build.id }))}
                    disabled={build.status !== 'in_progress'}
                  >
                    <Square className="h-4 w-4 mr-1" />
                    {t('devmanager.builds.stop')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info(t('devmanager.builds.sent_toast', { id: build.id }))}
                    disabled={build.status !== 'completed'}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {t('devmanager.builds.send_to_qa')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMBuildAssignment;
