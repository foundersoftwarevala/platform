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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/registry';
import { useTranslation } from '@/lib/i18n/use-translation';

// The platform's languages, from the one registry, A-Z. This screen listed
// eight hand-typed languages with invented coverage figures; which languages
// are on is decided in the Language Manager (/language-manager), which also
// reports real coverage.
const languages = [...SUPPORTED_LANGUAGES]
  .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  .map((l) => ({ code: l.code, name: l.name, nativeName: l.nativeName, flag: l.flag, enabled: l.enabled }));

export const SCLanguages: React.FC = () => {
  const { t } = useTranslation();
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [fallbackLanguage, setFallbackLanguage] = useState('en');
  const [searchQuery, setSearchQuery] = useState('');

  const enabledCount = languages.filter(l => l.enabled).length;

  const filteredLanguages = languages.filter(l =>
    `${l.name} ${l.nativeName} ${l.code}`.toLowerCase().includes(searchQuery.toLowerCase())
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
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <Link to="/language-manager">
                  <Plus className="w-4 h-4" />
                  {t('common.language_manage')}
                </Link>
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
          <CardContent className="max-h-[480px] space-y-2 overflow-y-auto overscroll-contain scroll-smooth">
            {filteredLanguages.map((lang) => (
              <motion.div
                key={lang.code}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  lang.enabled ? 'bg-card' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <div>
                    <p className="font-medium text-sm" translate="no">{lang.nativeName}</p>
                    <p className="text-xs text-muted-foreground" translate="no">{lang.name}</p>
                    <p className="text-xs text-muted-foreground uppercase">{lang.code}</p>
                  </div>
                </div>
                <Badge variant={lang.enabled ? 'default' : 'outline'}>{lang.enabled ? t('common.language_on') : t('common.language_off')}</Badge>
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
