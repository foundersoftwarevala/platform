/**
 * BOT TRAINING SCREEN
 * Train and improve your chatbot
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Upload,
  FileText,
  Link,
  Database,
  Sparkles,
  Brain,
  History,
  CheckCircle2,
  Clock,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useBotTrainingDocuments, useChatbots, useDeleteRow, relativeTime } from '@/hooks/useSalesSupportData';

export const CBBotTraining: React.FC = () => {
  const { data: documents, isLoading: docsLoading } = useBotTrainingDocuments();
  const { data: chatbots, isLoading: botsLoading } = useChatbots();
  const deleteDocument = useDeleteRow('bot_training_documents');

  const isLoading = docsLoading || botsLoading;
  const docs = documents ?? [];

  const totalDocs = docs.length;
  const totalChunks = docs.reduce((sum, d) => sum + (d.chunks ?? 0), 0);
  const avgAccuracy = docs.length
    ? Math.round(docs.reduce((sum, d) => sum + (d.accuracy ?? 0), 0) / docs.length)
    : 0;
  const lastTrained = docs
    .map((d) => d.last_trained_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  const handleUpload = () => {
    toast({ title: 'Upload started', description: 'Processing your file...' });
  };

  const handleRetrain = () => {
    toast({ title: 'Training started', description: 'This may take a few minutes' });
  };

  const handleDelete = (id: string) => {
    deleteDocument.mutate(id, {
      onSuccess: () => toast({ title: 'Document removed' }),
      onError: (e) => toast({ title: 'Failed to remove', description: String(e), variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Train Your Bot</h1>
          <p className="text-muted-foreground text-sm mt-1">Teach your chatbot to answer questions better</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRetrain}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retrain Bot
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Sparkles className="w-4 h-4 mr-2" />
            Auto-Improve
          </Button>
        </div>
      </div>

      {/* Training Status */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-800">Knowledge Base: {totalDocs ? 'Healthy' : 'Empty'}</h3>
                <p className="text-sm text-emerald-600">
                  Last trained {relativeTime(lastTrained)} • {avgAccuracy}% accuracy
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-700">{chatbots?.length ?? 0}</p>
                <p className="text-xs text-emerald-600">Chatbots</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-700">{totalChunks}</p>
                <p className="text-xs text-emerald-600">Training Chunks</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-700">{totalDocs}</p>
                <p className="text-xs text-emerald-600">Documents</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList className="bg-surface-2">
          <TabsTrigger value="upload">📄 Upload Content</TabsTrigger>
          <TabsTrigger value="versions">📜 Chatbots</TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Upload FAQ */}
            <Card className="bg-card border-border shadow-sm rounded-xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Upload FAQ Document
                </CardTitle>
                <CardDescription>PDF, DOC, or TXT files</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer"
                  onClick={handleUpload}
                >
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">Drop files here or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">Max 10MB per file</p>
                </div>
              </CardContent>
            </Card>

            {/* Import from URL */}
            <Card className="bg-card border-border shadow-sm rounded-xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link className="w-5 h-5 text-blue-600" />
                  Import from URL
                </CardTitle>
                <CardDescription>Crawl website content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="https://yoursite.com/faq" className="bg-surface" />
                <Button className="w-full" variant="outline" onClick={handleUpload}>
                  <Database className="w-4 h-4 mr-2" />
                  Fetch & Import
                </Button>
              </CardContent>
            </Card>

            {/* Training Progress */}
            <Card className="bg-card border-border shadow-sm rounded-xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-5 h-5 text-blue-600" />
                  Training Status
                </CardTitle>
                <CardDescription>Current model training</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Model Accuracy</span>
                    <span className="font-semibold text-emerald-600">{avgAccuracy}%</span>
                  </div>
                  <Progress value={avgAccuracy} className="h-2" />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Last trained: {relativeTime(lastTrained)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Uploaded Documents */}
          <Card className="bg-card border-border shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Uploaded Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Loading documents…</p>
              ) : docs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <span className="font-medium text-foreground">{doc.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            doc.status === 'processed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }
                        >
                          {doc.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600"
                          onClick={() => handleDelete(doc.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chatbots Tab */}
        <TabsContent value="versions">
          <Card className="bg-card border-border shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                Chatbots
              </CardTitle>
              <CardDescription>Resolution and escalation rate by bot</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Loading chatbots…</p>
              ) : !chatbots || chatbots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No chatbots configured yet.</p>
              ) : (
                <div className="space-y-3">
                  {chatbots.map((bot) => (
                    <div key={bot.id} className="flex items-center justify-between p-4 bg-surface rounded-xl">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            bot.status === 'active' ? 'bg-emerald-100' : 'bg-surface-3'
                          }`}
                        >
                          {bot.status === 'active' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <History className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{bot.name}</span>
                            {bot.status === 'active' && (
                              <Badge className="bg-emerald-100 text-emerald-700 text-xs">Active</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{bot.channel} • {bot.language}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-foreground">{bot.resolution_rate}%</p>
                          <p className="text-xs text-muted-foreground">Resolution</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
