/**
 * ANDROID INTEGRATION SCREEN
 * Mobile app chat widget settings
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Smartphone,
  MessageCircle,
  Bell,
  Wifi,
  WifiOff,
  Download,
  Settings,
  Palette,
  Move
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export const CBAndroidIntegration: React.FC = () => {
  const [settings, setSettings] = useState({
    chatWidget: true,
    floatingButton: true,
    pushNotifications: true,
    offlineMessages: true,
    position: 'bottom-right',
    theme: 'auto'
  });

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    toast({ title: 'Setting updated' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Android App Integration</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure chat widget for your Android app</p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => toast({ title: 'SDK download started', description: 'Android chat widget SDK v2.4.1' })}
        >
          <Download className="w-4 h-4 mr-2" />
          Download SDK
        </Button>
      </div>

      {/* Status Banner */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-emerald-800">SDK Connected</h3>
              <p className="text-sm text-emerald-600">App version 2.4.1 • 8,320 active users</p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700">✓ Active</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Widget Settings */}
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              Chat Widget
            </CardTitle>
            <CardDescription>Control how the chat appears in your app</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Chat Widget</p>
                  <p className="text-xs text-muted-foreground">Enable in-app chat support</p>
                </div>
              </div>
              <Switch
                checked={settings.chatWidget}
                onCheckedChange={(v) => updateSetting('chatWidget', v)}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-surface rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Move className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Floating Button</p>
                  <p className="text-xs text-muted-foreground">Show floating chat button</p>
                </div>
              </div>
              <Switch
                checked={settings.floatingButton}
                onCheckedChange={(v) => updateSetting('floatingButton', v)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Button Position</label>
              <Select 
                value={settings.position} 
                onValueChange={(v) => updateSetting('position', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">↘ Bottom Right</SelectItem>
                  <SelectItem value="bottom-left">↙ Bottom Left</SelectItem>
                  <SelectItem value="top-right">↗ Top Right</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Theme
              </label>
              <Select 
                value={settings.theme} 
                onValueChange={(v) => updateSetting('theme', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">🌓 Auto (Follow system)</SelectItem>
                  <SelectItem value="light">☀️ Light</SelectItem>
                  <SelectItem value="dark">🌙 Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications & Offline */}
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              Notifications & Offline
            </CardTitle>
            <CardDescription>Push notifications and offline behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Push Notifications</p>
                  <p className="text-xs text-muted-foreground">Notify users of new messages</p>
                </div>
              </div>
              <Switch
                checked={settings.pushNotifications}
                onCheckedChange={(v) => updateSetting('pushNotifications', v)}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-surface rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <WifiOff className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Offline Messages</p>
                  <p className="text-xs text-muted-foreground">Queue messages when offline</p>
                </div>
              </div>
              <Switch
                checked={settings.offlineMessages}
                onCheckedChange={(v) => updateSetting('offlineMessages', v)}
              />
            </div>

            <div className="p-4 bg-blue-50 rounded-xl">
              <h4 className="font-medium text-blue-800 text-sm mb-2">💡 Offline Mode</h4>
              <p className="text-xs text-blue-600">
                When enabled, users can compose messages while offline. 
                Messages are automatically sent when connection is restored.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Preview Card */}
        <Card className="lg:col-span-2 bg-card border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-600" />
              Widget Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className="relative w-64 h-[480px] bg-surface-2 rounded-[2.5rem] border-4 border-border overflow-hidden shadow-xl">
                {/* Phone screen */}
                <div className="absolute inset-2 bg-card rounded-[2rem] overflow-hidden">
                  {/* Status bar */}
                  <div className="h-6 bg-card/60 flex items-center justify-center">
                    <div className="w-16 h-1 bg-muted/40 rounded-full"></div>
                  </div>
                  
                  {/* App content */}
                  <div className="p-4 h-full bg-surface">
                    <div className="w-full h-4 bg-surface-3 rounded mb-3"></div>
                    <div className="w-3/4 h-4 bg-surface-3 rounded mb-6"></div>
                    <div className="w-full h-20 bg-surface-3 rounded mb-3"></div>
                    <div className="w-full h-20 bg-surface-3 rounded"></div>
                  </div>

                  {/* Floating button */}
                  {settings.floatingButton && (
                    <div className={`absolute ${
                      settings.position === 'bottom-right' ? 'bottom-4 right-4' :
                      settings.position === 'bottom-left' ? 'bottom-4 left-4' :
                      'top-12 right-4'
                    }`}>
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                        <MessageCircle className="w-6 h-6 text-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
