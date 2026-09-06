/**
 * SETTINGS
 * Developer management configuration
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings, Bell, Shield, Clock, Brain } from 'lucide-react';

export const DMSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure developer management preferences</p>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Task Assignment Alerts</Label>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label>Code Submission Notifications</Label>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label>Bug Report Alerts</Label>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label>Deadline Warnings</Label>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>IP Binding Enforcement</Label>
            <Switch defaultChecked disabled />
          </div>
          <div className="flex items-center justify-between">
            <Label>Device Binding</Label>
            <Switch defaultChecked disabled />
          </div>
          <div className="flex items-center justify-between">
            <Label>Session Timeout (30 min)</Label>
            <Switch defaultChecked />
          </div>
          <p className="text-xs text-muted-foreground">Security bindings cannot be disabled</p>
        </CardContent>
      </Card>

      {/* Automation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI & Automation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>AI Quality Scoring</Label>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label>Auto Delay Prediction</Label>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label>Skill Match Recommendations</Label>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Work Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Work Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Auto Work Hour Tracking</Label>
            <Switch defaultChecked disabled />
          </div>
          <div className="flex items-center justify-between">
            <Label>Overtime Alerts</Label>
            <Switch defaultChecked />
          </div>
          <p className="text-xs text-muted-foreground">Work hour tracking is always enabled</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMSettings;
