/**
 * LIVE CHAT INBOX
 * Real-time conversation management
 */

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search,
  Send,
  Bot,
  User,
  Phone,
  Mail,
  Globe,
  Smartphone,
  Clock,
  MessageCircle,
  ArrowRight,
  Star
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Conversation {
  id: string;
  userName: string;
  lastMessage: string;
  time: string;
  unread: number;
  status: 'bot' | 'human' | 'waiting';
  country: string;
}

interface Message {
  id: string;
  sender: 'bot' | 'user' | 'agent';
  text: string;
  time: string;
}

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  country: string;
  language: string;
  device: string;
  appVersion: string;
  previousChats: number;
}

const conversations: Conversation[] = [
  { id: '1', userName: 'Sarah Johnson', lastMessage: 'How do I reset my password?', time: '2m', unread: 2, status: 'bot', country: '🇺🇸' },
  { id: '2', userName: 'Rahul Sharma', lastMessage: 'I need help with billing', time: '5m', unread: 0, status: 'human', country: '🇮🇳' },
  { id: '3', userName: 'Emma Wilson', lastMessage: 'Thank you so much!', time: '12m', unread: 0, status: 'bot', country: '🇬🇧' },
  { id: '4', userName: 'Carlos García', lastMessage: 'Mi aplicación no funciona', time: '18m', unread: 1, status: 'waiting', country: '🇲🇽' },
  { id: '5', userName: 'Yuki Tanaka', lastMessage: 'Can I change my plan?', time: '25m', unread: 0, status: 'bot', country: '🇯🇵' },
];

const chatMessages: Message[] = [
  { id: '1', sender: 'user', text: 'Hi, I forgot my password and can\'t log in', time: '10:32 AM' },
  { id: '2', sender: 'bot', text: 'Hello Sarah! I\'m sorry to hear you\'re having trouble logging in. I can help you reset your password. Would you like me to send a password reset link to your email?', time: '10:32 AM' },
  { id: '3', sender: 'user', text: 'Yes please!', time: '10:33 AM' },
  { id: '4', sender: 'bot', text: 'I\'ve sent a password reset link to s***@email.com. Please check your inbox and spam folder. The link will expire in 15 minutes.', time: '10:33 AM' },
  { id: '5', sender: 'user', text: 'How do I reset my password?', time: '10:35 AM' },
];

const userProfile: UserProfile = {
  name: 'Sarah Johnson',
  email: 'sarah.j@email.com',
  phone: '+1 (555) 123-4567',
  country: 'United States',
  language: 'English',
  device: 'iPhone 15 Pro',
  appVersion: 'v2.4.1',
  previousChats: 3
};

export const CBLiveChatInbox: React.FC = () => {
  const [selectedChat, setSelectedChat] = useState(conversations[0]);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSend = () => {
    if (!message.trim()) return;
    toast({ title: 'Message sent' });
    setMessage('');
  };

  const statusColors = {
    bot: 'bg-blue-100 text-blue-700',
    human: 'bg-emerald-100 text-emerald-700',
    waiting: 'bg-orange-100 text-orange-700'
  };

  const statusLabels = {
    bot: '🤖 Bot handling',
    human: '👤 Agent assigned',
    waiting: '⏳ Waiting for agent'
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Live Chat Inbox</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage real-time customer conversations</p>
      </div>

      {/* Quick Stats */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1">
          🤖 {conversations.filter(c => c.status === 'bot').length} Bot handling
        </Badge>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1">
          👤 {conversations.filter(c => c.status === 'human').length} With agents
        </Badge>
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 px-3 py-1 animate-pulse">
          ⏳ {conversations.filter(c => c.status === 'waiting').length} Waiting
        </Badge>
      </div>

      {/* Main Chat Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-280px)] min-h-[500px]">
        {/* Conversation List */}
        <Card className="lg:col-span-3 bg-card border-border shadow-sm rounded-xl overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-surface"
              />
            </div>
          </div>
          <ScrollArea className="h-[calc(100%-60px)]">
            <div className="p-2 space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedChat(conv)}
                  className={`w-full p-3 rounded-xl text-left transition-all ${
                    selectedChat.id === conv.id 
                      ? 'bg-blue-50 border border-blue-200' 
                      : 'hover:bg-surface'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-foreground text-sm">
                        {conv.userName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-foreground flex items-center gap-1">
                          {conv.country} {conv.userName}
                        </span>
                        <span className="text-xs text-muted-foreground">{conv.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <Badge variant="outline" className={`text-[10px] ${statusColors[conv.status]}`}>
                          {statusLabels[conv.status]}
                        </Badge>
                        {conv.unread > 0 && (
                          <span className="w-5 h-5 bg-blue-600 rounded-full text-[10px] text-foreground flex items-center justify-center">
                            {conv.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Chat Window */}
        <Card className="lg:col-span-6 bg-card border-border shadow-sm rounded-xl flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-foreground">
                  {selectedChat.userName.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-foreground">{selectedChat.userName}</h3>
                <Badge variant="outline" className={`text-[10px] ${statusColors[selectedChat.status]}`}>
                  {statusLabels[selectedChat.status]}
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-blue-600 border-blue-200">
              <ArrowRight className="w-4 h-4 mr-1.5" />
              Take Over
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {chatMessages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${
                    msg.sender === 'user' 
                      ? 'bg-blue-600 text-foreground rounded-2xl rounded-br-md' 
                      : 'bg-surface-2 text-foreground rounded-2xl rounded-bl-md'
                  } px-4 py-2.5`}>
                    {msg.sender !== 'user' && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <Bot className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs font-medium text-blue-600">SupportBot</span>
                      </div>
                    )}
                    <p className="text-sm">{msg.text}</p>
                    <p className={`text-[10px] mt-1 ${msg.sender === 'user' ? 'text-blue-200' : 'text-muted-foreground'}`}>
                      {msg.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="flex-1"
              />
              <Button onClick={handleSend} className="bg-blue-600 hover:bg-blue-700">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* User Profile */}
        <Card className="lg:col-span-3 bg-card border-border shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border bg-gradient-to-br from-blue-50 to-indigo-50">
            <div className="text-center">
              <Avatar className="w-16 h-16 mx-auto mb-3">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-foreground text-xl">
                  {userProfile.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-foreground">{userProfile.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">Customer since Jan 2024</p>
            </div>
          </div>
          <ScrollArea className="h-[calc(100%-140px)]">
            <div className="p-4 space-y-4">
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Info</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{userProfile.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{userProfile.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{userProfile.country}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Device Info</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Smartphone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{userProfile.device}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">App {userProfile.appVersion}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{userProfile.language}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">History</h4>
                <div className="bg-surface rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Previous chats</span>
                    <Badge variant="outline">{userProfile.previousChats}</Badge>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  <Clock className="w-4 h-4 mr-2" />
                  View Chat History
                </Button>
              </div>
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
};
