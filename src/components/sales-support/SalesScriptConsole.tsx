import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Copy, Sparkles, Globe, CheckCircle, ChevronRight, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SalesScriptConsole = () => {
  const [selectedLanguage, setSelectedLanguage] = useState("english");

  const scripts = [
    { id: 1, title: "Initial Contact", category: "Opening", usage: 234, success: 78 },
    { id: 2, title: "Product Demo Intro", category: "Demo", usage: 189, success: 82 },
    { id: 3, title: "Pricing Discussion", category: "Closing", usage: 156, success: 65 },
    { id: 4, title: "Follow-Up Call", category: "Nurturing", usage: 312, success: 71 },
  ];

  const objections = [
    { objection: "Too expensive", response: "I understand budget is important. Let me show you the ROI our clients typically see within 3 months..." },
    { objection: "Need to think about it", response: "Of course! What specific aspects would you like to consider? I can provide additional information..." },
    { objection: "Already using another solution", response: "That's great you have a system in place. Many of our clients switched because of [specific benefit]..." },
    { objection: "Not the right time", response: "I appreciate your honesty. When would be a better time to revisit this? I can schedule a follow-up..." },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Sales Script Console</h2>
          <p className="text-muted-foreground">Ready-made pitch scripts with AI improvements</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-40 bg-card/60 border-border">
              <Globe className="w-4 h-4 mr-2 text-cyan-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="english">English</SelectItem>
              <SelectItem value="spanish">Spanish</SelectItem>
              <SelectItem value="french">French</SelectItem>
              <SelectItem value="arabic">Arabic</SelectItem>
              <SelectItem value="hindi">Hindi</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 text-foreground">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Improve
          </Button>
        </div>
      </div>

      <Tabs defaultValue="scripts" className="space-y-4">
        <TabsList className="bg-card/60">
          <TabsTrigger value="scripts">Pitch Scripts</TabsTrigger>
          <TabsTrigger value="objections">Objection Handling</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="scripts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scripts.map((script, index) => (
              <motion.div
                key={script.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="bg-card/60 border-cyan-500/20 hover:border-cyan-500/40 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-cyan-100">{script.title}</h4>
                          <Badge className="bg-muted/40 text-muted-foreground mt-1">{script.category}</Badge>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-cyan-300">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Used {script.usage} times</span>
                      <span className="text-emerald-400">{script.success}% success</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card className="bg-card/60 border-cyan-500/20">
            <CardHeader>
              <CardTitle className="text-cyan-100 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
                Sample Script: Initial Contact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-card/60 rounded-lg p-4 space-y-3">
                <p className="text-muted-foreground">
                  <span className="text-cyan-400 font-medium">Opening:</span> "Hello [Name], this is [Your Name] from Software Vala. I noticed you were interested in our [Product Category]. Do you have a moment to discuss how we can help streamline your operations?"
                </p>
                <p className="text-muted-foreground">
                  <span className="text-cyan-400 font-medium">Value Prop:</span> "Our solution has helped over 500 businesses reduce their operational costs by up to 40%. I'd love to show you a quick demo tailored to your industry."
                </p>
                <p className="text-muted-foreground">
                  <span className="text-cyan-400 font-medium">Close:</span> "Would you be available for a 15-minute demo this week? I can show you exactly how this would work for [Company Name]."
                </p>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="border-cyan-500/30 text-cyan-300">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Script
                </Button>
                <Button className="bg-cyan-500 hover:bg-cyan-600 text-foreground">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Personalize with AI
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="objections" className="space-y-4">
          <Card className="bg-card/60 border-cyan-500/20">
            <CardHeader>
              <CardTitle className="text-cyan-100">Common Objections & Responses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {objections.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-card/60 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-red-500/20 text-red-300">Objection</Badge>
                    <span className="font-medium text-foreground">"{item.objection}"</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 mt-1" />
                    <p className="text-muted-foreground text-sm">{item.response}</p>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card className="bg-card/60 border-cyan-500/20">
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-cyan-100 mb-2">Email & Message Templates</h3>
              <p className="text-muted-foreground mb-4">Pre-written templates for follow-ups, introductions, and more</p>
              <Button className="bg-cyan-500 hover:bg-cyan-600 text-foreground">
                Browse Templates
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalesScriptConsole;
