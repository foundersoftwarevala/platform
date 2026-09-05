import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Bell, Clock, AlertTriangle, Shield, Save, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const SSMSettingsModule = () => {
  const [settings, setSettings] = useState({
    // Notification Settings
    emailNotifications: true,
    pushNotifications: true,
    slaBreachAlerts: true,
    escalationAlerts: true,
    dailyDigest: true,
    
    // Working Hours
    workStartHour: "09:00",
    workEndHour: "18:00",
    timezone: "UTC+0",
    workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    
    // SLA Configs
    defaultResponseTime: 30,
    criticalResponseTime: 15,
    autoEscalationEnabled: true,
    autoEscalationThreshold: 15,
    
    // Escalation Rules
    level1Timeout: 30,
    level2Timeout: 60,
    level3Timeout: 120,
    managerOverrideEnabled: true,
  });

  const handleSave = () => {
    toast.loading("Saving settings...", { id: "save" });
    setTimeout(() => {
      toast.success("Settings saved successfully", { id: "save" });
    }, 800);
  };

  const handleReset = () => {
    toast.info("Settings reset to defaults");
  };

  const updateSetting = (key: string, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Settings</h2>
          <p className="text-muted-foreground">Configure notifications, SLA, working hours, and escalation rules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} className="border-border">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} className="bg-cyan-500 hover:bg-cyan-600 text-foreground">
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notification Settings */}
        <Card className="bg-card/60 border-cyan-500/20">
          <CardHeader>
            <CardTitle className="text-cyan-100 flex items-center gap-2">
              <Bell className="w-5 h-5 text-cyan-400" />
              Notification Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Email Notifications</Label>
              <Switch checked={settings.emailNotifications} onCheckedChange={(v) => updateSetting("emailNotifications", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Push Notifications</Label>
              <Switch checked={settings.pushNotifications} onCheckedChange={(v) => updateSetting("pushNotifications", v)} />
            </div>
            <Separator className="bg-muted/40" />
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">SLA Breach Alerts</Label>
              <Switch checked={settings.slaBreachAlerts} onCheckedChange={(v) => updateSetting("slaBreachAlerts", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Escalation Alerts</Label>
              <Switch checked={settings.escalationAlerts} onCheckedChange={(v) => updateSetting("escalationAlerts", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Daily Digest Email</Label>
              <Switch checked={settings.dailyDigest} onCheckedChange={(v) => updateSetting("dailyDigest", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Working Hours */}
        <Card className="bg-card/60 border-cyan-500/20">
          <CardHeader>
            <CardTitle className="text-cyan-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              Working Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground mb-2 block">Start Time</Label>
                <Input 
                  type="time" 
                  value={settings.workStartHour} 
                  onChange={(e) => updateSetting("workStartHour", e.target.value)}
                  className="bg-card/60 border-border"
                />
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">End Time</Label>
                <Input 
                  type="time" 
                  value={settings.workEndHour} 
                  onChange={(e) => updateSetting("workEndHour", e.target.value)}
                  className="bg-card/60 border-border"
                />
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground mb-2 block">Timezone</Label>
              <Select value={settings.timezone} onValueChange={(v) => updateSetting("timezone", v)}>
                <SelectTrigger className="bg-card/60 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC-8">UTC-8 (PST)</SelectItem>
                  <SelectItem value="UTC-5">UTC-5 (EST)</SelectItem>
                  <SelectItem value="UTC+0">UTC+0 (GMT)</SelectItem>
                  <SelectItem value="UTC+5:30">UTC+5:30 (IST)</SelectItem>
                  <SelectItem value="UTC+8">UTC+8 (SGT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground mb-2 block">Working Days</Label>
              <div className="flex gap-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                  <Badge 
                    key={day}
                    className={`cursor-pointer ${settings.workDays.includes(day) ? "bg-cyan-500/20 text-cyan-300" : "bg-muted/40 text-muted-foreground"}`}
                    onClick={() => {
                      const newDays = settings.workDays.includes(day) 
                        ? settings.workDays.filter(d => d !== day)
                        : [...settings.workDays, day];
                      updateSetting("workDays", newDays);
                    }}
                  >
                    {day}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SLA Configs */}
        <Card className="bg-card/60 border-cyan-500/20">
          <CardHeader>
            <CardTitle className="text-cyan-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              SLA Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground mb-2 block">Default Response Time (minutes)</Label>
              <Input 
                type="number" 
                value={settings.defaultResponseTime} 
                onChange={(e) => updateSetting("defaultResponseTime", parseInt(e.target.value))}
                className="bg-card/60 border-border"
              />
            </div>
            <div>
              <Label className="text-muted-foreground mb-2 block">Critical Response Time (minutes)</Label>
              <Input 
                type="number" 
                value={settings.criticalResponseTime} 
                onChange={(e) => updateSetting("criticalResponseTime", parseInt(e.target.value))}
                className="bg-card/60 border-border"
              />
            </div>
            <Separator className="bg-muted/40" />
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Auto-Escalation</Label>
              <Switch checked={settings.autoEscalationEnabled} onCheckedChange={(v) => updateSetting("autoEscalationEnabled", v)} />
            </div>
            <div>
              <Label className="text-muted-foreground mb-2 block">Auto-Escalation Threshold (minutes)</Label>
              <Input 
                type="number" 
                value={settings.autoEscalationThreshold} 
                onChange={(e) => updateSetting("autoEscalationThreshold", parseInt(e.target.value))}
                className="bg-card/60 border-border"
                disabled={!settings.autoEscalationEnabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Escalation Rules */}
        <Card className="bg-card/60 border-cyan-500/20">
          <CardHeader>
            <CardTitle className="text-cyan-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-cyan-400" />
              Escalation Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground mb-2 block">Level 1 → 2 Timeout (minutes)</Label>
              <Input 
                type="number" 
                value={settings.level1Timeout} 
                onChange={(e) => updateSetting("level1Timeout", parseInt(e.target.value))}
                className="bg-card/60 border-border"
              />
            </div>
            <div>
              <Label className="text-muted-foreground mb-2 block">Level 2 → 3 Timeout (minutes)</Label>
              <Input 
                type="number" 
                value={settings.level2Timeout} 
                onChange={(e) => updateSetting("level2Timeout", parseInt(e.target.value))}
                className="bg-card/60 border-border"
              />
            </div>
            <div>
              <Label className="text-muted-foreground mb-2 block">Level 3 Alert Timeout (minutes)</Label>
              <Input 
                type="number" 
                value={settings.level3Timeout} 
                onChange={(e) => updateSetting("level3Timeout", parseInt(e.target.value))}
                className="bg-card/60 border-border"
              />
            </div>
            <Separator className="bg-muted/40" />
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Manager Override Enabled</Label>
              <Switch checked={settings.managerOverrideEnabled} onCheckedChange={(v) => updateSetting("managerOverrideEnabled", v)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SSMSettingsModule;
