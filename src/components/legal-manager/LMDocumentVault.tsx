import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Lock, FileText, Upload, Download, Eye, Shield, Calendar } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useLegalDocuments, useLogAction, useUpsertDocument } from '@/lib/legal-data';
import { motion } from 'framer-motion';

interface VaultDocument {
  id: string;
  name: string;
  type: 'contract' | 'agreement' | 'license' | 'compliance' | 'legal_notice';
  uploadedAt: string;
  uploadedBy: string;
  size: string;
  encrypted: boolean;
  accessLevel: 'legal_only' | 'legal_admin';
  expiryDate?: string;
  storagePath?: string;
}


const LMDocumentVault: React.FC = () => {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('');
  const [accessLevel, setAccessLevel] = useState('');
  const { data: documentRows = [], isLoading } = useLegalDocuments();
  const uploadDocument = useUpsertDocument();
  const logAction = useLogAction();

  const documents: VaultDocument[] = documentRows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.doc_type as VaultDocument['type'],
    uploadedAt: row.uploaded_at,
    uploadedBy: row.uploaded_by,
    size: row.size_label,
    encrypted: row.encrypted,
    accessLevel: row.access_level as VaultDocument['accessLevel'],
    expiryDate: row.expiry_date ?? undefined,
    storagePath: row.storage_path ?? undefined,
  }));

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'contract': return 'bg-blue-500/20 text-blue-400';
      case 'agreement': return 'bg-green-500/20 text-green-400';
      case 'license': return 'bg-purple-500/20 text-purple-400';
      case 'compliance': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }
    if (!docType) {
      toast.error('Please select document type');
      return;
    }
    if (!accessLevel) {
      toast.error('Please select access level');
      return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(uploadFile.type)) {
      toast.error('Only PDF and Word documents are allowed');
      return;
    }

    // Validate file size (max 10MB)
    if (uploadFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    const storagePath = `${Date.now()}-${uploadFile.name}`;
    const { error: storageError } = await supabase.storage
      .from('legal-documents')
      .upload(storagePath, uploadFile, { contentType: uploadFile.type });

    if (storageError) {
      toast.error(`Upload failed: ${storageError.message}`);
      return;
    }

    try {
      await uploadDocument.mutateAsync({
        name: uploadFile.name,
        doc_type: docType,
        access_level: accessLevel,
        size_label:
          uploadFile.size > 1024 * 1024
            ? `${(uploadFile.size / (1024 * 1024)).toFixed(1)} MB`
            : `${Math.round(uploadFile.size / 1024)} KB`,
        storage_path: storagePath,
      });
    } catch (error) {
      await supabase.storage.from('legal-documents').remove([storagePath]);
      toast.error(error instanceof Error ? error.message : 'Could not save document');
      return;
    }

    toast.success('Document uploaded to the secure vault');
    setIsUploadOpen(false);
    setUploadFile(null);
    setDocType('');
    setAccessLevel('');
  };

  const openDocument = async (doc: VaultDocument, disposition: 'view' | 'download') => {
    if (!doc.storagePath) {
      toast.error('No file is attached to this record yet');
      return;
    }
    const { data, error } = await supabase.storage
      .from('legal-documents')
      .createSignedUrl(doc.storagePath, 60);
    if (error || !data) {
      toast.error(error?.message ?? 'Could not create download link');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    logAction.mutate({
      action: disposition === 'view' ? 'Document Viewed' : 'Document Downloaded',
      category: 'document',
      actor: 'LM-A1B2',
      details: `${disposition === 'view' ? 'Viewed' : 'Downloaded'} ${doc.name}`,
    });
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          Contract & Document Vault
          <Badge variant="outline" className="ml-2 gap-1">
            <Shield className="h-3 w-3" />
            Encrypted
          </Badge>
        </CardTitle>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Secure Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Document File *</Label>
                <Input 
                  type="file" 
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">PDF or Word documents only. Max 10MB.</p>
              </div>

              <div className="space-y-2">
                <Label>Document Type *</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="agreement">Agreement</SelectItem>
                    <SelectItem value="license">License</SelectItem>
                    <SelectItem value="compliance">Compliance Report</SelectItem>
                    <SelectItem value="legal_notice">Legal Notice</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Access Level *</Label>
                <Select value={accessLevel} onValueChange={setAccessLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select access" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="legal_only">Legal Only</SelectItem>
                    <SelectItem value="legal_admin">Legal + Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 rounded bg-green-500/10 border border-green-500/30 text-sm">
                <Lock className="h-4 w-4 text-green-400 inline mr-2" />
                Document will be encrypted at rest with AES-256 encryption.
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancel</Button>
                <Button onClick={handleUpload} disabled={uploadDocument.isPending}>Upload & Encrypt</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading vault…</p>
          )}
          {!isLoading && documents.length === 0 && (
            <p className="text-sm text-muted-foreground">No documents in the vault yet.</p>
          )}
          {documents.map((doc, index) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 rounded-lg bg-background/50 border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-muted/50">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium">{doc.name}</span>
                      <Badge className={getTypeColor(doc.type)}>{doc.type.replace('_', ' ')}</Badge>
                      {doc.encrypted && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Lock className="h-3 w-3" />
                          Encrypted
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{doc.size}</span>
                      <span>•</span>
                      <span>Uploaded: {doc.uploadedAt}</span>
                      {doc.expiryDate && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Expires: {doc.expiryDate}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => openDocument(doc, 'view')}>
                    <Eye className="h-3 w-3" />
                    View
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={() => openDocument(doc, 'download')}
                    className="gap-1"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded bg-muted/30 border border-border/50 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-4 w-4" />
            Access: Legal + Admin only. All downloads are logged.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LMDocumentVault;
