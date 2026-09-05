import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { 
  Bot, Globe, Smartphone, MessageCircle as WhatsApp, Settings, GraduationCap,
  MoreVertical, Trash2, Copy, BarChart3
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { useChatbots, useUpdateRow, useInsertRow, type Chatbot } from '@/hooks/useSalesSupportData';

const channelConfig: Record<string, { icon: any; label: string; color: string }> = {
  web: { icon: Globe, label: 'Website', color: 'bg-blue-100 text-blue-700' },
  android: { icon: Smartphone, label: 'Android App', color: 'bg-emerald-100 text-emerald-700' },
  whatsapp: { icon: WhatsApp, label: 'WhatsApp', color: 'bg-green-100 text-green-700' },
};

export const CBChatbotManagement: React.FC = () => {
  const { data: bots, isLoading } = useChatbots();
  const updateBot = useUpdateRow('chatbots');
  const insertBot = useInsertRow('chatbots');

  const allBots = bots ?? [];

  const handleToggle = async (bot: Chatbot) => {
    try {
      await updateBot.mutateAsync({ id: bot.id, values: { status: bot.status === 'live' ? 'paused' : 'live' } });
      toast({ title: 'Bot status updated' });
    } catch {
      toast({ title: 'Failed to update bot', variant: 'destructive' });
    }
  };

  const handleCreate = async () => {
    try {
      await insertBot.mutateAsync({ name: 'New Bot', channel: 'web', status: 'paused', language: 'en', conversations: 0, resolution_rate: 0, escalation_rate: 0 });
      toast({ title: 'Bot created' });
    } catch {
      toast({ title: 'Failed to create bot', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Chatbots</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage your AI chatbots</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleCreate}>
          <Bot className="w-4 h-4 mr-2" />
          Create New Bot
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></div>
          {allBots.filter(b => b.status === 'live').length} Live Bots
        </Badge>
        <Badge variant="outline" className="bg-surface text-muted-foreground border-border px-3 py-1">
          {allBots.filter(b => b.status === 'paused').length} Paused
        </Badge>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1">
          {allBots.reduce((sum, b) => sum + b.conversations, 0).toLocaleString()} Total Conversations
        </Badge>
      </div>

      {/* Bot Cards */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading chatbots...</div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allBots.map((bot) => {
          const channel = channelConfig[bot.channel] ?? channelConfig.web;
          const ChannelIcon = channel.icon;

          return (
            <Card 
              key={bot.id} 
              className={`bg-card border-border shadow-sm hover:shadow-md transition-all rounded-xl ${
                bot.status === 'paused' ? 'opacity-80' : ''
              }`}
            >
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <Bot className="w-6 h-6 text-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{bot.name}</h3>
                        {bot.status === 'live' && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{bot.purpose ?? '—'}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Settings className="w-4 h-4 mr-2" /> Settings</DropdownMenuItem>
                      <DropdownMenuItem><BarChart3 className="w-4 h-4 mr-2" /> Analytics</DropdownMenuItem>
                      <DropdownMenuItem><Copy className="w-4 h-4 mr-2" /> Duplicate</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Badges Row */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="outline" className={`text-xs ${channel.color}`}>
                    <ChannelIcon className="w-3 h-3 mr-1" />
                    {channel.label}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-surface text-muted-foreground border-border">
                    🌐 {bot.language}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-surface rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{bot.conversations.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Conversations</p>
                  </div>
                  <div className="bg-surface rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-emerald-600">{bot.resolution_rate}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Resolution Rate</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={bot.status === 'live'}
                      onCheckedChange={() => handleToggle(bot)}
                    />
                    <span className={`text-sm font-medium ${bot.status === 'live' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {bot.status === 'live' ? 'Live' : 'Paused'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Settings className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                      <GraduationCap className="w-3.5 h-3.5 mr-1.5" />
                      Train
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}
    </div>
  );
};
