/**
 * MULTI-LANGUAGE SUPPORT SCREEN
 * Configure language settings
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Languages, Plus, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useBotLanguages, useUpdateRow, useInsertRow } from '@/hooks/useSalesSupportData';

export const CBMultiLanguage: React.FC = () => {
  const { data: languages, isLoading } = useBotLanguages();
  const updateLanguage = useUpdateRow('bot_languages');
  const insertLanguage = useInsertRow('bot_languages');
  const [fallbackLang, setFallbackLang] = useState('en');

  const languagesList = languages ?? [];

  const toggleLanguage = (id: string, enabled: boolean) => {
    updateLanguage.mutate(
      { id, values: { is_enabled: !enabled } },
      {
        onSuccess: () => toast({ title: 'Language settings updated' }),
        onError: (e) => toast({ title: 'Update failed', description: String(e), variant: 'destructive' }),
      },
    );
  };

  const handleAddLanguage = () => {
    insertLanguage.mutate(
      { name: 'New Language', code: 'xx', is_enabled: false, coverage: 0, conversations: 0 },
      {
        onSuccess: () => toast({ title: 'Language added' }),
        onError: (e) => toast({ title: 'Add failed', description: String(e), variant: 'destructive' }),
      },
    );
  };

  const enabledCount = languagesList.filter((l) => l.is_enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Language Support</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure multi-language chatbot responses</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleAddLanguage}>
          <Plus className="w-4 h-4 mr-2" />
          Add Language
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1">
          🌐 {enabledCount} Languages Active
        </Badge>
        <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 px-3 py-1">
          🔄 Fallback: {fallbackLang.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              Translation Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Fallback Language
              </label>
              <Select value={fallbackLang} onValueChange={setFallbackLang}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languagesList.filter((l) => l.is_enabled).map((l) => (
                    <SelectItem key={l.id} value={l.code}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1.5">
                Used when language detection fails
              </p>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                💡 Pro tip: Enable more languages for better global support coverage
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Languages List */}
        <Card className="lg:col-span-2 bg-card border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Languages className="w-5 h-5 text-blue-600" />
              Languages
            </CardTitle>
            <CardDescription>Toggle language availability and coverage</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading languages…</p>
            ) : languagesList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No languages configured yet.</p>
            ) : (
              <div className="space-y-2">
                {languagesList.map((lang) => (
                  <div
                    key={lang.id}
                    className={`flex items-center justify-between p-4 rounded-xl border ${
                      lang.is_enabled
                        ? 'bg-card border-border'
                        : 'bg-surface border-border opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{lang.name}</span>
                          <Badge variant="outline" className="text-[10px]">{lang.code.toUpperCase()}</Badge>
                          {lang.code === fallbackLang && (
                            <Badge className="bg-violet-100 text-violet-700 text-[10px]">Fallback</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-20 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                lang.coverage >= 90 ? 'bg-emerald-500' :
                                lang.coverage >= 70 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${lang.coverage}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{lang.coverage}% coverage</span>
                          <span className="text-[10px] text-muted-foreground">• {lang.conversations} chats</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Enabled</span>
                        <Switch
                          checked={lang.is_enabled}
                          onCheckedChange={() => toggleLanguage(lang.id, lang.is_enabled)}
                          disabled={lang.code === fallbackLang}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
