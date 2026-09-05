/**
 * Quick Support Component
 * Fast support with attachments for rapid requirement resolution
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Send, Paperclip, X, Loader2, 
  CheckCircle2, AlertTriangle, Bug, Lightbulb, CreditCard, Zap,
  Upload, FileText, Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Attachment {
  name: string;
  size: number;
  type: string;
  url?: string;
}

const requestTypes = [
  { id: 'change', label: 'Request Change', icon: Lightbulb, color: 'text-blue-500' },
  { id: 'bug', label: 'Report Bug', icon: Bug, color: 'text-red-500' },
  { id: 'feature', label: 'New Feature', icon: Zap, color: 'text-purple-500' },
  { id: 'payment', label: 'Payment Issue', icon: CreditCard, color: 'text-green-500' },
  { id: 'urgent', label: 'Urgent Help', icon: AlertTriangle, color: 'text-orange-500' },
];

const QuickSupport: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [requestType, setRequestType] = useState('change');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "File too large",
          description: `${file.name} exceeds 10MB limit`,
          variant: "destructive"
        });
        continue;
      }
      newAttachments.push({
        name: file.name,
        size: file.size,
        type: file.type
      });
    }

    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast({
        title: "Required Fields",
        description: "Please fill in subject and description",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const priority = requestType === 'urgent' ? 'urgent' : 
                       requestType === 'bug' ? 'high' : 'normal';

      const { error } = await supabase
        .from('quick_support_requests')
        .insert({
          user_id: user?.id,
          user_email: user?.email,
          request_type: requestType,
          priority,
          subject: subject.trim(),
          description: description.trim(),
          attachments: attachments as any
        } as any);

      if (error) throw error;

      // Log the support request
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'quick_support_created',
        module: 'support',
        meta_json: {
          type: requestType,
          priority,
          has_attachments: attachments.length > 0
        }
      });

      setIsSuccess(true);
      toast({
        title: "Request Submitted! ✅",
        description: "We'll respond within 2 hours for urgent requests.",
      });

      // Reset after 2 seconds
      setTimeout(() => {
        setIsSuccess(false);
        setIsOpen(false);
        setSubject('');
        setDescription('');
        setAttachments([]);
        setRequestType('change');
      }, 2000);

    } catch (error: any) {
      console.error('Support error:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-primary to-neon-purple shadow-lg flex items-center justify-center text-foreground hover:opacity-90 transition-opacity"
        >
          <MessageSquare className="w-6 h-6" />
        </motion.button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Quick Support
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="py-8 text-center"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Request Submitted!</h3>
              <p className="text-sm text-muted-foreground mt-2">
                We'll get back to you shortly.
              </p>
            </motion.div>
          ) : (
            <motion.form
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {/* Request Type */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  What do you need?
                </label>
                <div className="flex flex-wrap gap-2">
                  {requestTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setRequestType(type.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          requestType === type.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${requestType === type.id ? '' : type.color}`} />
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Subject
                </label>
                <Input
                  placeholder="Brief description of your request"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Details
                </label>
                <Textarea
                  placeholder="Describe your requirement in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Attachments (optional)
                </label>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-dashed"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Add Screenshots or Files
                </Button>

                {/* Attachment List */}
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {file.type.startsWith('image/') ? (
                            <ImageIcon className="w-4 h-4 text-blue-500" />
                          ) : (
                            <FileText className="w-4 h-4 text-orange-500" />
                          )}
                          <span className="truncate max-w-[150px]">{file.name}</span>
                          <span className="text-muted-foreground">
                            ({formatFileSize(file.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-primary to-neon-purple"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Request
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                ⚡ Urgent requests get priority response within 2 hours
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default QuickSupport;
