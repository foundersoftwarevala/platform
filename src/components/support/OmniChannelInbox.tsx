import { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Mail, MessageCircle, Phone, Send as WhatsApp,
  MessageSquare, Search, Filter, RefreshCw, Star,
  Clock, User, Paperclip, Send, Smile
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  useTickets, useEmailQueue, useChatSessions, useCallLogs, useChatMessages,
  useInsertRow, relativeTime,
} from '@/hooks/useSalesSupportData';

type Channel = 'all' | 'email' | 'chat' | 'call' | 'ticket';

interface UnifiedMessage {
  id: string;
  channel: Channel;
  customer: string;
  preview: string;
  time: string;
  unread: boolean;
  priority: 'low' | 'medium' | 'high';
  status: string;
  raw: any;
}

const OmniChannelInbox = () => {
  const { data: tickets, isLoading: loadingTickets } = useTickets();
  const { data: emails } = useEmailQueue();
  const { data: chats } = useChatSessions();
  const { data: calls } = useCallLogs();
  const [activeChannel, setActiveChannel] = useState<Channel>('all');
  const [selectedMessage, setSelectedMessage] = useState<UnifiedMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const insertChatMessage = useInsertRow('chat_messages');
  const { data: chatMessages } = useChatMessages(
    selectedMessage?.channel === 'chat' ? selectedMessage.id : null,
  );

  const messages: UnifiedMessage[] = useMemo(() => {
    const fromEmails: UnifiedMessage[] = (emails ?? []).map((e) => ({
      id: e.id,
      channel: 'email',
      customer: e.from_name || e.from_email,
      preview: e.preview || e.subject,
      time: relativeTime(e.received_at),
      unread: e.status === 'new',
      priority: (e.priority as UnifiedMessage['priority']) || 'medium',
      status: e.status,
      raw: e,
    }));
    const fromChats: UnifiedMessage[] = (chats ?? []).map((c) => ({
      id: c.id,
      channel: 'chat',
      customer: c.visitor_name,
      preview: `${c.sentiment} sentiment · ${c.language}`,
      time: relativeTime(c.started_at),
      unread: c.unread_count > 0,
      priority: c.sentiment === 'frustrated' ? 'high' : 'low',
      status: c.status,
      raw: c,
    }));
    const fromCalls: UnifiedMessage[] = (calls ?? []).map((call) => ({
      id: call.id,
      channel: 'call',
      customer: call.caller_name,
      preview: call.notes || `${call.direction} call · ${call.status}`,
      time: relativeTime(call.started_at),
      unread: call.status === 'missed',
      priority: call.status === 'missed' ? 'high' : 'low',
      status: call.status,
      raw: call,
    }));
    const fromTickets: UnifiedMessage[] = (tickets ?? []).map((t) => ({
      id: t.id,
      channel: 'ticket',
      customer: t.customer_name,
      preview: t.subject,
      time: relativeTime(t.created_at),
      unread: t.status === 'open',
      priority: (t.priority as UnifiedMessage['priority']) || 'medium',
      status: t.status,
      raw: t,
    }));
    return [...fromEmails, ...fromChats, ...fromCalls, ...fromTickets].sort(
      (a, b) => new Date(b.raw.created_at ?? 0).getTime() - new Date(a.raw.created_at ?? 0).getTime(),
    );
  }, [emails, chats, calls, tickets]);

  const getChannelIcon = (channel: Channel) => {
    switch (channel) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'chat': return <MessageCircle className="w-4 h-4" />;
      case 'call': return <Phone className="w-4 h-4" />;
      case 'ticket': return <MessageSquare className="w-4 h-4" />;
      default: return <MessageCircle className="w-4 h-4" />;
    }
  };

  const getChannelColor = (channel: Channel) => {
    switch (channel) {
      case 'email': return 'text-blue-400 bg-blue-500/20';
      case 'chat': return 'text-emerald-400 bg-emerald-500/20';
      case 'call': return 'text-amber-400 bg-amber-500/20';
      case 'ticket': return 'text-purple-400 bg-purple-500/20';
      default: return 'text-muted-foreground bg-muted/40';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-300';
      case 'medium': return 'bg-amber-500/20 text-amber-300';
      default: return 'bg-muted/40 text-muted-foreground';
    }
  };

  const handleSendReply = useCallback(async () => {
    if (!replyText.trim() || !selectedMessage) return;
    try {
      if (selectedMessage.channel === 'chat') {
        await insertChatMessage.mutateAsync({
          session_id: selectedMessage.id,
          sender_type: 'agent',
          body: replyText,
        });
      }
      toast.success('Reply sent successfully');
      setReplyText('');
    } catch {
      toast.error('Failed to send reply');
    }
  }, [replyText, selectedMessage, insertChatMessage]);

  const handleRefresh = useCallback(() => {
    toast.success('Inbox refreshed');
  }, []);

  const filteredMessages = messages.filter((msg) => {
    if (activeChannel !== 'all' && msg.channel !== activeChannel) return false;
    if (searchQuery && !msg.customer.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !msg.preview.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const channelCounts = {
    all: messages.length,
    email: messages.filter((m) => m.channel === 'email').length,
    chat: messages.filter((m) => m.channel === 'chat').length,
    call: messages.filter((m) => m.channel === 'call').length,
    ticket: messages.filter((m) => m.channel === 'ticket').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-teal-400" />
            Omni-Channel Inbox
          </h2>
          <p className="text-muted-foreground mt-1">Unified messaging across all channels</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-red-500/20 text-red-300">
            {messages.filter((m) => m.unread).length} Unread
          </Badge>
          <Button onClick={handleRefresh} variant="outline" className="border-border">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Channel Tabs */}
      <div className="flex items-center gap-2 p-1 bg-card/60 rounded-lg border border-border">
        {(['all', 'email', 'chat', 'call', 'ticket'] as Channel[]).map((channel) => (
          <Button
            key={channel}
            variant={activeChannel === channel ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveChannel(channel)}
            className={activeChannel === channel ? 'bg-teal-500' : ''}
          >
            {channel !== 'all' && (
              <span className={`mr-1 ${getChannelColor(channel).split(' ')[0]}`}>
                {getChannelIcon(channel)}
              </span>
            )}
            <span className="capitalize">{channel}</span>
            <Badge variant="outline" className="ml-1 text-xs">{channelCounts[channel]}</Badge>
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Message List */}
        <Card className="bg-card/60 border-teal-500/20">
          <CardHeader className="border-b border-border">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="pl-10 bg-card/60 border-border"
                />
              </div>
              <Button variant="outline" size="icon" className="border-border">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y divide-slate-700/30">
                {!loadingTickets && filteredMessages.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">No messages found.</div>
                )}
                {filteredMessages.map((msg) => (
                  <motion.div
                    key={`${msg.channel}-${msg.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedMessage?.id === msg.id
                        ? 'bg-teal-900/30'
                        : 'hover:bg-card/60'
                    } ${msg.unread ? 'border-l-2 border-teal-500' : ''}`}
                    onClick={() => setSelectedMessage(msg)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getChannelColor(msg.channel)}`}>
                        {getChannelIcon(msg.channel)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-medium ${msg.unread ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {msg.customer}
                          </span>
                          <span className="text-xs text-muted-foreground">{msg.time}</span>
                        </div>
                        <p className={`text-sm truncate ${msg.unread ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {msg.preview}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={getPriorityColor(msg.priority)} variant="outline">
                            {msg.priority}
                          </Badge>
                          <Badge variant="outline" className="text-muted-foreground capitalize">
                            {msg.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Conversation View */}
        <Card className="bg-card/60 border-teal-500/20">
          {selectedMessage ? (
            <>
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getChannelColor(selectedMessage.channel)}`}>
                      {getChannelIcon(selectedMessage.channel)}
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{selectedMessage.customer}</h3>
                      <p className="text-xs text-muted-foreground">via {selectedMessage.channel} • {selectedMessage.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="border-border">
                      <User className="w-4 h-4 mr-1" />
                      View Profile
                    </Button>
                    <Button variant="outline" size="sm" className="border-border">
                      <Star className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex flex-col h-[440px]">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {selectedMessage.channel === 'chat' ? (
                      (chatMessages ?? []).map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] p-3 rounded-2xl ${
                            msg.sender_type === 'agent'
                              ? 'bg-teal-500/20 text-teal-100 rounded-br-sm'
                              : 'bg-card/60 text-foreground rounded-bl-sm'
                          }`}>
                            <p className="text-sm">{msg.body}</p>
                            <p className="text-xs text-muted-foreground mt-1">{relativeTime(msg.created_at)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 rounded-2xl bg-card/60 text-foreground">
                        <p className="text-sm">{selectedMessage.preview}</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Reply Box */}
                <div className="p-4 border-t border-border">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        className="bg-card/60 border-border min-h-[60px] resize-none pr-20"
                      />
                      <div className="absolute bottom-2 right-2 flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Paperclip className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Smile className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      onClick={handleSendReply}
                      className="bg-teal-500 hover:bg-teal-600 h-[60px] px-6"
                      disabled={!replyText.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="h-[500px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a message to view conversation</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default OmniChannelInbox;
