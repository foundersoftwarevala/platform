/**
 * Internal Support AI - Security & Privacy
 * No Chat Delete, No Edit, No Copy, No Share, No Screenshot, Masked Identity
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  Copy,
  Share2,
  Camera,
  Mail,
  Phone,
  CreditCard,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';

interface SecurityPrivacyProps {
  activeView: string;
}

export const SecurityPrivacy: React.FC<SecurityPrivacyProps> = ({ activeView }) => {
  const securityRules = [
    { id: 'no-delete', label: 'No Chat Delete', icon: <Trash2 className="w-4 h-4" />, status: 'enforced', description: 'All conversations are permanently logged' },
    { id: 'no-edit', label: 'No Edit', icon: <Edit3 className="w-4 h-4" />, status: 'enforced', description: 'Messages cannot be modified after sending' },
    { id: 'no-copy', label: 'No Copy', icon: <Copy className="w-4 h-4" />, status: 'enforced', description: 'Text selection and copying disabled' },
    { id: 'no-share', label: 'No Share', icon: <Share2 className="w-4 h-4" />, status: 'enforced', description: 'Sharing functionality blocked' },
    { id: 'no-screenshot', label: 'No Screenshot', icon: <Camera className="w-4 h-4" />, status: 'enforced', description: 'Screenshot detection active' },
    { id: 'masked-id', label: 'Masked Identity', icon: <EyeOff className="w-4 h-4" />, status: 'enforced', description: 'Internal ID only, no personal data exposed' }
  ];

  const dataProtection = [
    { id: 'no-email', label: 'No Email Exposure', icon: <Mail className="w-4 h-4" />, protected: true },
    { id: 'no-mobile', label: 'No Mobile Exposure', icon: <Phone className="w-4 h-4" />, protected: true },
    { id: 'no-banking', label: 'No Banking / File Sharing', icon: <CreditCard className="w-4 h-4" />, protected: true },
    { id: 'no-export', label: 'No Data Export', icon: <FileText className="w-4 h-4" />, protected: true }
  ];

  const accessLog = [
    { id: 'ACC-001', userId: 'USR-***42', action: 'View Issue', timestamp: '12:45:32', allowed: true },
    { id: 'ACC-002', userId: 'USR-***87', action: 'Submit Feedback', timestamp: '12:44:18', allowed: true },
    { id: 'ACC-003', userId: 'USR-***15', action: 'Copy Attempt', timestamp: '12:43:02', allowed: false },
    { id: 'ACC-004', userId: 'USR-***63', action: 'Screenshot Attempt', timestamp: '12:41:45', allowed: false },
    { id: 'ACC-005', userId: 'USR-***29', action: 'View Resolution', timestamp: '12:40:15', allowed: true }
  ];

  return (
    <div className="space-y-4">
      {/* Security Status Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">Security Status</h3>
                  <p className="text-[10px] text-muted-foreground">All security measures are active and enforced</p>
                </div>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-3 py-1">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                ALL SYSTEMS SECURE
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Security Rules Grid */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              Security Rules (Enforced)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {securityRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-4 bg-card/60 rounded-lg border border-emerald-500/20"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400">
                      {rule.icon}
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px]">
                      <Lock className="w-2 h-2 mr-1" />
                      ENFORCED
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground font-medium">{rule.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{rule.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Data Protection */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-purple-400" />
              Data Protection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              {dataProtection.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20 text-center"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mx-auto mb-2 text-purple-400">
                    {item.icon}
                  </div>
                  <p className="text-xs text-foreground font-medium">{item.label}</p>
                  <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px] mt-2">
                    PROTECTED
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Access Log */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                Security Access Log
              </CardTitle>
              <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px]">
                <Lock className="w-3 h-3 mr-1" />
                READ-ONLY
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {accessLog.map((log, idx) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    log.allowed 
                      ? 'bg-card/60 border-border' 
                      : 'bg-red-500/5 border-red-500/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground">{log.timestamp}</span>
                    <span className="text-xs text-muted-foreground">{log.userId}</span>
                    <span className="text-xs text-foreground">{log.action}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {log.allowed ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px]">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        ALLOWED
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px]">
                        <XCircle className="w-3 h-3 mr-1" />
                        BLOCKED
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* System Lock Notice */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-foreground">System Lock Status</h3>
                <p className="text-[10px] text-muted-foreground">
                  No UI changes, feature changes, theme changes, or behavior changes without explicit approval
                </p>
              </div>
              <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-3 py-1">
                <Lock className="w-3 h-3 mr-1" />
                FULLY LOCKED
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
