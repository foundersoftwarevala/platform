/**
 * SETTINGS
 * Developer management configuration
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings, Bell, Shield, Clock, Brain } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/use-translation';

export const DMSettings: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.settings.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.settings.subtitle')}</p>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('devmanager.settings.notifications')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dm-settings-task-assignment">{t('devmanager.settings.task_assignment_alerts')}</Label>
            <Switch id="dm-settings-task-assignment" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="dm-settings-code-submission">{t('devmanager.settings.code_submission_notifications')}</Label>
            <Switch id="dm-settings-code-submission" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="dm-settings-bug-report">{t('devmanager.settings.bug_report_alerts')}</Label>
            <Switch id="dm-settings-bug-report" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="dm-settings-deadline">{t('devmanager.settings.deadline_warnings')}</Label>
            <Switch id="dm-settings-deadline" defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('devmanager.settings.security')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dm-settings-ip-binding">{t('devmanager.settings.ip_binding')}</Label>
            <Switch id="dm-settings-ip-binding" defaultChecked disabled />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="dm-settings-device-binding">{t('devmanager.settings.device_binding')}</Label>
            <Switch id="dm-settings-device-binding" defaultChecked disabled />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="dm-settings-session-timeout">{t('devmanager.settings.session_timeout')}</Label>
            <Switch id="dm-settings-session-timeout" defaultChecked />
          </div>
          <p className="text-xs text-muted-foreground">{t('devmanager.settings.bindings_locked')}</p>
        </CardContent>
      </Card>

      {/* Automation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {t('devmanager.settings.automation')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dm-settings-ai-quality">{t('devmanager.settings.ai_quality_scoring')}</Label>
            <Switch id="dm-settings-ai-quality" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="dm-settings-delay-prediction">{t('devmanager.settings.auto_delay_prediction')}</Label>
            <Switch id="dm-settings-delay-prediction" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="dm-settings-skill-match">{t('devmanager.settings.skill_match')}</Label>
            <Switch id="dm-settings-skill-match" defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Work Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('devmanager.settings.work_hours')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dm-settings-work-hour-tracking">{t('devmanager.settings.work_hour_tracking')}</Label>
            <Switch id="dm-settings-work-hour-tracking" defaultChecked disabled />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="dm-settings-overtime">{t('devmanager.settings.overtime_alerts')}</Label>
            <Switch id="dm-settings-overtime" defaultChecked />
          </div>
          <p className="text-xs text-muted-foreground">{t('devmanager.settings.tracking_always_on')}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMSettings;
