/**
 * ROLE & SKILL MAPPING
 * Skill Matrix • Tech Stack • Project Eligibility • AI Match Score
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Layers, Code2, FolderKanban, Brain } from 'lucide-react';

const skillMatrix = [
  { skill: 'React', developers: 12, level: 'Expert', coverage: 85 },
  { skill: 'Node.js', developers: 8, level: 'Expert', coverage: 70 },
  { skill: 'Python', developers: 6, level: 'Advanced', coverage: 55 },
  { skill: 'TypeScript', developers: 10, level: 'Expert', coverage: 80 },
  { skill: 'AWS', developers: 5, level: 'Intermediate', coverage: 45 },
  { skill: 'Docker', developers: 7, level: 'Advanced', coverage: 60 },
];

const techStack = [
  { name: 'Frontend', techs: ['React', 'Vue.js', 'Angular', 'TypeScript'] },
  { name: 'Backend', techs: ['Node.js', 'Python', 'Java', 'Go'] },
  { name: 'Mobile', techs: ['React Native', 'Flutter', 'Swift', 'Kotlin'] },
  { name: 'DevOps', techs: ['Docker', 'K8s', 'AWS', 'CI/CD'] },
];

const projectEligibility = [
  { project: 'Project Alpha', required: ['React', 'Node.js'], eligible: 8 },
  { project: 'Project Beta', required: ['Python', 'AWS'], eligible: 4 },
  { project: 'Project Gamma', required: ['React Native', 'Firebase'], eligible: 3 },
];

export const DMRoleSkillMapping: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Role & Skill Mapping</h1>
        <p className="text-muted-foreground">Developer skills and project eligibility</p>
      </div>

      {/* Skill Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Skill Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {skillMatrix.map((skill) => (
              <div key={skill.skill} className="flex items-center gap-4">
                <div className="w-24">
                  <span className="font-medium">{skill.skill}</span>
                </div>
                <div className="flex-1">
                  <Progress value={skill.coverage} className="h-2" />
                </div>
                <div className="w-20 text-right">
                  <span className="text-sm text-muted-foreground">{skill.developers} devs</span>
                </div>
                <Badge variant="outline">{skill.level}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {/* Tech Stack */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              Tech Stack Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {techStack.map((stack) => (
                <div key={stack.name}>
                  <p className="font-medium mb-2">{stack.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {stack.techs.map((tech) => (
                      <Badge key={tech} variant="secondary">{tech}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Project Eligibility */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderKanban className="h-5 w-5" />
              Project Eligibility
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projectEligibility.map((project) => (
                <div key={project.project} className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium mb-2">{project.project}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {project.required.map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">{project.eligible} eligible</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Skill Match */}
      <Card className="bg-purple-500/5 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-purple-500">
            <Brain className="h-5 w-5" />
            AI Skill Match Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-5xl font-bold text-purple-500 mb-2">87%</div>
            <p className="text-sm text-muted-foreground">Overall team skill-project alignment</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMRoleSkillMapping;
