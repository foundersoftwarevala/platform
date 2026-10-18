/**
 * Internal Support AI - Security & Privacy
 * No Chat Delete, No Edit, No Copy, No Share, No Screenshot, Masked Identity
 */

import React from "react";
import { EmptyRow } from "../states";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  AlertTriangle,
} from "lucide-react";

interface SecurityPrivacyProps {
  activeView: string;
}

export const SecurityPrivacy: React.FC<SecurityPrivacyProps> = ({ activeView }) => {
  // What this module actually enforces. Each line states the mechanism, and
  // a control the browser cannot fully enforce is marked partial, not enforced.
  const securityRules: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    status: "enforced" | "partial";
    description: string;
  }> = [
    {
      id: "no-delete",
      label: "No Delete",
      icon: <Trash2 className="w-4 h-4" />,
      status: "enforced",
      description: "This module exposes no delete action on any record",
    },
    {
      id: "no-edit",
      label: "No Edit",
      icon: <Edit3 className="w-4 h-4" />,
      status: "enforced",
      description: "All views here are read-only; no record can be modified",
    },
    {
      id: "no-copy",
      label: "No Copy",
      icon: <Copy className="w-4 h-4" />,
      status: "enforced",
      description: "Copy, cut, paste and the context menu are blocked in this module",
    },
    {
      id: "no-share",
      label: "No Share",
      icon: <Share2 className="w-4 h-4" />,
      status: "enforced",
      description: "No share or export action exists in this module",
    },
    {
      id: "no-screenshot",
      label: "No Screenshot",
      icon: <Camera className="w-4 h-4" />,
      status: "partial",
      description:
        "PrintScreen key is intercepted; a browser cannot detect or block OS screenshots",
    },
    {
      id: "masked-id",
      label: "Masked Identity",
      icon: <EyeOff className="w-4 h-4" />,
      status: "enforced",
      description: "People are shown by masked internal ID only, never name, email or phone",
    },
  ];

  const dataProtection = [
    {
      id: "no-email",
      label: "No Email Exposure",
      icon: <Mail className="w-4 h-4" />,
      protected: true,
    },
    {
      id: "no-mobile",
      label: "No Mobile Exposure",
      icon: <Phone className="w-4 h-4" />,
      protected: true,
    },
    {
      id: "no-banking",
      label: "No Banking / File Sharing",
      icon: <CreditCard className="w-4 h-4" />,
      protected: true,
    },
    {
      id: "no-export",
      label: "No Data Export",
      icon: <FileText className="w-4 h-4" />,
      protected: true,
    },
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
                  <p className="text-[10px] text-muted-foreground">
                    Module-level UI controls; screenshot blocking is partial
                  </p>
                </div>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-3 py-1">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                UI CONTROLS ACTIVE
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Security Rules Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
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
                    {rule.status === "enforced" ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px]">
                        <Lock className="w-2 h-2 mr-1" />
                        ENFORCED
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/20 text-amber-400 text-[9px]">
                        <AlertTriangle className="w-2 h-2 mr-1" />
                        PARTIAL
                      </Badge>
                    )}
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
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
              <EmptyRow>
                Not tracked. Copy attempts are blocked and the PrintScreen key is intercepted in the
                browser, but neither is recorded anywhere, so there is no access log to show.
              </EmptyRow>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* System Lock Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-foreground">System Lock Status</h3>
                <p className="text-[10px] text-muted-foreground">
                  No UI changes, feature changes, theme changes, or behavior changes without
                  explicit approval
                </p>
              </div>
              <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-3 py-1">
                <Lock className="w-3 h-3 mr-1" />
                POLICY
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
