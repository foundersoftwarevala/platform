/**
 * SCREEN 4: BOT TRAINING
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Link, Plus, Trash2, Save, RefreshCw, BookOpen, MessageSquare, Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  useBotTrainingDocuments, useChatbots, useInsertRow, useDeleteRow, relativeTime,
} from '@/hooks/useSalesSupportData';

export const SCBotTraining: React.FC = () => {
  const { data: documents, isLoading } = useBotTrainingDocuments();
  const { data: bots } = useChatbots();
  const insertDoc = useInsertRow('bot_training_documents');
  const deleteDoc = useDeleteRow('bot_training_documents');
  const [urlInput, setUrlInput] = useState('');

  const allDocs = documents ?? [];
  const avgAccuracy = allDocs.length
    ? Math.round(allDocs.reduce((sum, d) => sum + d.accuracy, 0) / allDocs.length)
    : 0;
  const totalChunks = allDocs.reduce((sum, d) => sum + d.chunks, 0);

  const handleUpload = async () => {
    try {
      await insertDoc.mutateAsync({ title: 'New Document.pdf', source_type: 'pdf', status: 'processing', chunks: 0, accuracy: 0 });
      toast.success('Upload started');
    } catch {
      toast.error('Failed to start upload');
    }
  };

  const handleImportUrl = async () => {
    if (!urlInput.trim()) return;
    try {
      await insertDoc.mutateAsync({ title: urlInput, source_type: 'url', status: 'processing', chunks: 0, accuracy: 0 });
      toast.success('URL added for crawling');
      setUrlInput('');
    } catch {
      toast.error('Failed to import URL');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc.mutateAsync(id);
      toast.success('Document removed');
    } catch {
      toast.error('Failed to remove document');
    }
  };

  const urlDocs = allDocs.filter((d) => d.source_type === 'url');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bot Training</h1>
        <p className="text-sm text-muted-foreground mt-1">Train your chatbot with knowledge</p>
      </div>

      {/* Training Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Knowledge Items', value: String(allDocs.length), icon: BookOpen, color: 'text-blue-600 bg-blue-500/10' },
          { label: 'Total Chunks', value: String(totalChunks), icon: Brain, color: 'text-purple-600 bg-purple-500/10' },
          { label: 'Training Accuracy', value: `${avgAccuracy}%`, icon: MessageSquare, color: 'text-green-600 bg-green-500/10' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="w-4 h-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-2">
            <BookOpen className="w-4 h-4" />
            Knowledge Base
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File Upload */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Upload Documents</CardTitle>
                <CardDescription>PDF, DOC, or TXT files</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={handleUpload}
                >
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">Drop files here or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">Max 10MB per file</p>
                </div>
              </CardContent>
            </Card>

            {/* URL Import */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Import from URL</CardTitle>
                <CardDescription>Crawl help pages or FAQs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/faq"
                    className="flex-1"
                  />
                  <Button onClick={handleImportUrl}>
                    <Link className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {urlDocs.length === 0 && (
                    <p className="text-xs text-muted-foreground">No URLs imported yet.</p>
                  )}
                  {urlDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <span className="text-sm truncate flex-1">{doc.title}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDelete(doc.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => toast.success('Training started')}>
              <RefreshCw className="w-4 h-4" />
              Start Training
            </Button>
          </div>
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Knowledge Base Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <p className="text-sm text-muted-foreground text-center py-6">Loading documents...</p>}
              {!isLoading && allDocs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No training documents yet.</p>
              )}
              {allDocs.map((kb, index) => (
                <motion.div
                  key={kb.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{kb.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Last trained: {kb.last_trained_at ? relativeTime(kb.last_trained_at) : 'Never'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="uppercase text-[10px]">{kb.source_type}</Badge>
                    <Badge variant={kb.status === 'trained' ? 'default' : 'secondary'}>
                      {kb.status}
                    </Badge>
                    {kb.status === 'processing' && (
                      <div className="w-20">
                        <Progress value={65} className="h-1" />
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(kb.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
