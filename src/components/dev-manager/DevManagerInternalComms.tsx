import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send, Clock, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAddInternalNote, useDeliveryOverview } from '@/hooks/useDevManagerData';

export default function DevManagerInternalComms() {
  const { toast } = useToast();
  const { data, isLoading, error } = useDeliveryOverview();
  const addNote = useAddInternalNote();
  const [newNote, setNewNote] = useState('');
  const [selectedTask, setSelectedTask] = useState('');

  const notes = data?.notes ?? [];
  const taskOptions = data?.taskOptions ?? [];

  const handleAddNote = async () => {
    if (newNote.trim().length < 3 || !selectedTask) {
      toast({
        title: "Missing Information",
        description: "Select a task and enter a note (min 3 characters).",
        variant: "destructive"
      });
      return;
    }

    try {
      await addNote.mutateAsync({ taskId: selectedTask, content: newNote.trim() });
      setNewNote('');
      setSelectedTask('');
    } catch {
      // failure surfaced by the mutation's error toast
    }
  };

  return (
    <Card className="bg-card/60 border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            INTERNAL COMMUNICATION
          </CardTitle>
          <Badge variant="outline" className="text-xs flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Internal Only
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Note Form */}
        <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-3">
          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            className="w-full p-2 bg-card border border-border rounded text-sm"
          >
            <option value="">Select Task...</option>
            {taskOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} - {t.title}
              </option>
            ))}
          </select>
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add internal note (visible to managers only)..."
            className="bg-card border-border min-h-[80px] text-sm"
          />
          <Button
            size="sm"
            onClick={handleAddNote}
            disabled={addNote.isPending}
            className="w-full gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            {addNote.isPending ? 'Saving…' : 'Add Note'}
          </Button>
        </div>

        {/* Notes List */}
        <div className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground font-mono">Loading notes…</p>}
          {error && (
            <p className="text-sm text-red-400 font-mono">
              {error instanceof Error ? error.message : 'Failed to load notes'}
            </p>
          )}
          {notes.map((note, idx) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-3 bg-muted/30 rounded-lg border border-border"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {note.taskCode}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">{note.author}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <p className="text-sm text-foreground/80">{note.content}</p>
            </motion.div>
          ))}
          {!isLoading && !error && notes.length === 0 && (
            <p className="text-sm text-muted-foreground">No internal notes yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
