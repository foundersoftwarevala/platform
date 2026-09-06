import { motion } from "framer-motion";
import { PageBanner, PageShell, SeedNotice } from "@/components/ai-ceo/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Calendar,
  Download,
  Mail,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp
} from "lucide-react";

// Mock reports data
const reports = [
  {
    id: 1,
    title: "Daily AI Summary",
    type: "daily",
    generatedAt: "Today, 6:00 AM",
    status: "delivered",
    recipients: ["Boss", "CEO"],
    highlights: ["847 actions monitored", "3 risks detected", "12 approvals pending"]
  },
  {
    id: 2,
    title: "Weekly Executive Brief",
    type: "weekly",
    generatedAt: "Sunday, 8:00 PM",
    status: "delivered",
    recipients: ["Boss", "CEO"],
    highlights: ["Revenue +8%", "New franchises: 12", "SLA compliance: 99.2%"]
  },
  {
    id: 3,
    title: "Monthly Risk Report",
    type: "monthly",
    generatedAt: "Dec 31, 2024",
    status: "delivered",
    recipients: ["Boss"],
    highlights: ["45 risks addressed", "0 critical breaches", "Fraud prevented: $24K"]
  },
  {
    id: 4,
    title: "Decision Accuracy Report",
    type: "monthly",
    generatedAt: "Dec 31, 2024",
    status: "delivered",
    recipients: ["Boss", "CEO"],
    highlights: ["AI accuracy: 94%", "False positives: 3%", "Improvement: +2%"]
  },
];

const upcomingReports = [
  { title: "Daily AI Summary", scheduled: "Tomorrow 6:00 AM" },
  { title: "Weekly Executive Brief", scheduled: "Sunday 8:00 PM" },
  { title: "Monthly Risk Report", scheduled: "Jan 31, 2025" },
];

const getTypeColor = (type: string) => {
  switch (type) {
    case 'daily': return 'bg-primary/20 text-primary-glow';
    case 'weekly': return 'bg-accent-pink/20 text-accent-pink';
    case 'monthly': return 'bg-accent-emerald/20 text-accent-emerald';
    default: return 'bg-muted/20 text-muted-foreground';
  }
};

const AICEOReports = () => {
  return (
    <PageShell>
      <PageBanner
        icon={FileText}
        title="AI Reports"
        subtitle="Executive briefings and AI-generated reports, ready for download and board review."
        status="Auto-generated daily"
      />

      <SeedNotice waitingFor="a report generator and a schedule runner" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Daily Reports", count: 365, icon: Calendar, color: "text-primary-glow" },
          { label: "Weekly Reports", count: 52, icon: TrendingUp, color: "text-accent-pink" },
          { label: "Monthly Reports", count: 12, icon: FileText, color: "text-accent-emerald" },
          { label: "Delivered", count: "100%", icon: CheckCircle, color: "text-primary-glow" },
        ].map((stat, i) => (
          <Card key={stat.label} className="card3d premium-halo enter-soft rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <div>
                <p className="text-lg font-bold text-foreground">{stat.count}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Reports */}
        <div className="lg:col-span-2">
          <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl h-full">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-glow" />
                Recent Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {reports.map((report, i) => (
                    <motion.div
                      key={report.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-4 rounded-xl bg-surface border border-border hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-foreground">{report.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{report.generatedAt}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getTypeColor(report.type)}>{report.type}</Badge>
                          <Badge className="bg-accent-emerald/20 text-accent-emerald">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {report.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Delivered to: {report.recipients.join(", ")}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {report.highlights.map((highlight, j) => (
                          <Badge key={j} variant="outline" className="text-xs">
                            {highlight}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex justify-end">
                        <Button size="sm" variant="ghost" className="text-primary-glow hover:text-primary-glow">
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Reports */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent-pink" />
              Upcoming Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingReports.map((report, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-4 rounded-lg bg-surface border border-border"
                >
                  <p className="text-sm font-medium text-foreground">{report.title}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{report.scheduled}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Notice */}
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary-glow" />
          <p className="text-sm text-primary-glow/80">
            <strong>Report Delivery:</strong> All reports are auto-generated and delivered to Boss and CEO. No manual intervention required.
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default AICEOReports;
