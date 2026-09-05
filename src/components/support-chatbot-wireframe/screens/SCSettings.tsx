/**
 * SETTINGS SCREEN
 */
import React, { useState } from 'react';
import { Settings, Bell, Shield, Bot, Save, Key, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export const SCSettings: React.FC = () => {
  const [settings, setSettings] = useState({
    botName: 'Support Bot',
    welcomeMessage: 'Hello! How can I help you today?',
    aiModel: 'gpt-4',
    responseDelay: '500',
    emailNotifications: true,
    slackNotifications: false,
    escalationAlerts: true,
    dailyReport: true,
  });

  const handleSave = () => {
    toast.success('Settings saved successfully');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your chatbot</p>
        </div>
        <Button className="gap-2" onClick={handleSave}>
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Bot className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Key className="w-4 h-4" />
            API
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bot Configuration</CardTitle>
              <CardDescription>Basic chatbot settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bot Name</Label>
                  <Input 
                    value={settings.botName}
                    onChange={(e) => setSettings(s => ({ ...s, botName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>AI Model</Label>
                  <Select 
                    value={settings.aiModel}
                    onValueChange={(v) => setSettings(s => ({ ...s, aiModel: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-3.5">GPT-3.5 Turbo</SelectItem>
                      <SelectItem value="claude">Claude</SelectItem>
                      <SelectItem value="gemini">Gemini Pro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Welcome Message</Label>
                <Input 
                  value={settings.welcomeMessage}
                  onChange={(e) => setSettings(s => ({ ...s, welcomeMessage: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Response Delay (ms)</Label>
                <Input 
                  type="number"
                  value={settings.responseDelay}
                  onChange={(e) => setSettings(s => ({ ...s, responseDelay: e.target.value }))}
                  className="max-w-[200px]"
                />
                <p className="text-xs text-muted-foreground">Simulates typing delay for natural feel</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Widget Appearance</CardTitle>
              <CardDescription>Customize chat widget look</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <Input type="color" defaultValue="#10b981" className="w-12 h-10 p-1" />
                    <Input defaultValue="#10b981" className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select defaultValue="bottom-right">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Preferences</CardTitle>
              <CardDescription>Control how you receive alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive alerts via email' },
                { key: 'slackNotifications', label: 'Slack Notifications', desc: 'Send alerts to Slack' },
                { key: 'escalationAlerts', label: 'Escalation Alerts', desc: 'Notify on human handover' },
                { key: 'dailyReport', label: 'Daily Report', desc: 'Daily performance summary' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch 
                    checked={settings[item.key as keyof typeof settings] as boolean}
                    onCheckedChange={(v) => setSettings(s => ({ ...s, [item.key]: v }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API */}
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Keys</CardTitle>
              <CardDescription>Manage API access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input type="password" value="sk-xxxxxxxxxxxxxxxxxxxx" readOnly className="flex-1 font-mono" />
                  <Button variant="outline">Regenerate</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input placeholder="https://your-server.com/webhook" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security Settings</CardTitle>
              <CardDescription>Protect your chatbot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: 'Rate Limiting', desc: 'Limit requests per user', enabled: true },
                { label: 'IP Blocking', desc: 'Block suspicious IPs', enabled: true },
                { label: 'Content Filtering', desc: 'Filter inappropriate content', enabled: true },
                { label: 'Data Encryption', desc: 'Encrypt stored messages', enabled: true },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch checked={item.enabled} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
