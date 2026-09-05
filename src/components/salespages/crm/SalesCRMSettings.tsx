import { motion } from "framer-motion";
import { 
  User, 
  Building, 
  Bell, 
  Lock, 
  Palette,
  Database,
  Mail,
  Globe,
  Save
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SalesCRMSettings = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your CRM preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-surface-2">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-2">
            <Building className="w-4 h-4" />
            Company
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="w-4 h-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-foreground text-2xl font-bold">
                  JD
                </div>
                <div>
                  <Button variant="outline">Change Photo</Button>
                  <p className="text-sm text-muted-foreground mt-2">JPG, GIF or PNG. Max size 2MB</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>First Name</Label>
                  <Input defaultValue="John" className="mt-1" />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input defaultValue="Doe" className="mt-1" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" defaultValue="john@company.com" className="mt-1" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input defaultValue="+91 98765 43210" className="mt-1" />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select defaultValue="manager">
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Sales Manager</SelectItem>
                      <SelectItem value="executive">Sales Executive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Select defaultValue="ist">
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ist">IST (India)</SelectItem>
                      <SelectItem value="pst">PST (US)</SelectItem>
                      <SelectItem value="est">EST (US)</SelectItem>
                      <SelectItem value="gmt">GMT (UK)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button className="gap-2 bg-blue-500 hover:bg-blue-600">
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Settings */}
        <TabsContent value="company">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Manage your company details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label>Company Name</Label>
                  <Input defaultValue="ABC Enterprises Pvt Ltd" className="mt-1" />
                </div>
                <div>
                  <Label>Industry</Label>
                  <Select defaultValue="technology">
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="services">Services</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Company Size</Label>
                  <Select defaultValue="small">
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solo">Solo</SelectItem>
                      <SelectItem value="small">2-10 employees</SelectItem>
                      <SelectItem value="medium">11-50 employees</SelectItem>
                      <SelectItem value="large">50+ employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Website</Label>
                  <Input defaultValue="www.company.com" className="mt-1" />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select defaultValue="inr">
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inr">INR (₹)</SelectItem>
                      <SelectItem value="usd">USD ($)</SelectItem>
                      <SelectItem value="eur">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button className="gap-2 bg-blue-500 hover:bg-blue-600">
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-surface">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive email for new leads and updates</p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-surface">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-green-100">
                      <Bell className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Task Reminders</p>
                      <p className="text-sm text-muted-foreground">Get reminded about upcoming tasks</p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-surface">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-purple-100">
                      <Database className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Deal Updates</p>
                      <p className="text-sm text-muted-foreground">Notifications when deals progress</p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-surface">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-orange-100">
                      <Globe className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Weekly Reports</p>
                      <p className="text-sm text-muted-foreground">Receive weekly performance summary</p>
                    </div>
                  </div>
                  <Switch />
                </div>
              </div>

              <Button className="gap-2 bg-blue-500 hover:bg-blue-600">
                <Save className="w-4 h-4" />
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Current Password</Label>
                  <Input type="password" className="mt-1" />
                </div>
                <div>
                  <Label>New Password</Label>
                  <Input type="password" className="mt-1" />
                </div>
                <div>
                  <Label>Confirm New Password</Label>
                  <Input type="password" className="mt-1" />
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between p-4 rounded-xl bg-surface">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-green-100">
                      <Lock className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Two-Factor Authentication</p>
                      <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                    </div>
                  </div>
                  <Switch />
                </div>
              </div>

              <Button className="gap-2 bg-blue-500 hover:bg-blue-600">
                <Save className="w-4 h-4" />
                Update Security
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Powered By Footer */}
      <div className="text-center py-6 border-t border-border">
        <p className="text-sm text-muted-foreground">
          Powered by <span className="font-semibold text-blue-600">Software Vala</span>
        </p>
      </div>
    </div>
  );
};

export default SalesCRMSettings;
