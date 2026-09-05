/**
 * LANGUAGES SCREEN
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, Check, Plus, Search, Languages } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸', enabled: true, coverage: 100 },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', enabled: true, coverage: 95 },
  { code: 'fr', name: 'French', flag: '🇫🇷', enabled: true, coverage: 88 },
  { code: 'de', name: 'German', flag: '🇩🇪', enabled: true, coverage: 82 },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', enabled: true, coverage: 75 },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳', enabled: false, coverage: 60 },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', enabled: false, coverage: 45 },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', enabled: false, coverage: 30 },
];

export const SCLanguages: React.FC = () => {
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [fallbackLanguage, setFallbackLanguage] = useState('en');
  const [searchQuery, setSearchQuery] = useState('');

  const enabledCount = languages.filter(l => l.enabled).length;

  const filteredLanguages = languages.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Languages</h1>
        <p className="text-sm text-muted-foreground mt-1">Multi-language support settings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{enabledCount}</p>
              <p className="text-xs text-muted-foreground">Active Languages</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <Languages className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">Auto</p>
              <p className="text-xs text-muted-foreground">Translation Mode</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10">
              <Check className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">English</p>
              <p className="text-xs text-muted-foreground">Fallback Language</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Language List */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Available Languages</CardTitle>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search languages..."
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredLanguages.map((lang, index) => (
              <motion.div
                key={lang.code}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  lang.enabled ? 'bg-card' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <div>
                    <p className="font-medium text-sm">{lang.name}</p>
                    <p className="text-xs text-muted-foreground uppercase">{lang.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 hidden sm:block">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Coverage</span>
                      <span>{lang.coverage}%</span>
                    </div>
                    <Progress value={lang.coverage} className="h-1" />
                  </div>
                  <Switch checked={lang.enabled} />
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Settings */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Auto Translation</CardTitle>
              <CardDescription>Automatically translate messages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Enable auto-translate</span>
                <Switch checked={autoTranslate} onCheckedChange={setAutoTranslate} />
              </div>
              {autoTranslate && (
                <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                  Messages will be automatically translated to user's preferred language.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fallback Language</CardTitle>
              <CardDescription>When translation unavailable</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={fallbackLanguage} onValueChange={setFallbackLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.filter(l => l.enabled).map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        {lang.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Language Detection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Auto-detect user language', enabled: true },
                { label: 'Ask user preference', enabled: false },
                { label: 'Remember user choice', enabled: true },
              ].map((option, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm">{option.label}</span>
                  <Switch checked={option.enabled} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
