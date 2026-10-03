/**
 * ROLE & SKILL MAPPING
 * Skill Matrix • Tech Stack • Project Eligibility • AI Match Score
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Layers, Code2, FolderKanban, Brain } from 'lucide-react';
import { useAllDeveloperTasks, useDeveloperRegistry } from '@/hooks/useDevManagerData';
import { useTranslation } from '@/lib/i18n/use-translation';

/**
 * Skills, from the developers' own skill tags and the tech stack of their
 * tasks. The matrix, stack groups, three projects and the 87% match were typed
 * in. Coverage is the share of registered developers holding the skill; the
 * level shown is how many hold it. Projects are the open tasks with a stack,
 * and "eligible" counts developers whose tags cover that stack. There is no AI
 * match model, so that score is not shown as a number.
 */
export const DMRoleSkillMapping: React.FC = () => {
  const { t } = useTranslation();
  const registry = useDeveloperRegistry();
  const tasks = useAllDeveloperTasks();
  const devs = (registry.data ?? []).filter((d) => d.status !== 'exited');
  const norm = (s: string) => s.trim().toLowerCase();
  const counts = new Map<string, { label: string; n: number }>();
  for (const d of devs) for (const tag of new Set(d.skillTags.map(norm))) {
    const label = d.skillTags.find((t) => norm(t) === tag) ?? tag;
    counts.set(tag, { label, n: (counts.get(tag)?.n ?? 0) + 1 });
  }
  const skillMatrix = [...counts.values()].sort((a, b) => b.n - a.n).map((c) => ({
    skill: c.label,
    developers: c.n,
    level: c.n >= 5
      ? t('devmanager.skills.level_strong')
      : c.n >= 2
        ? t('devmanager.skills.level_covered')
        : t('devmanager.skills.level_single'),
    coverage: devs.length ? Math.round((c.n / devs.length) * 100) : 0,
  }));
  const stackOf = (t: { techStack: string[] }) => t.techStack;
  const openTasks = (tasks.data ?? []).filter((t) => t.status !== 'completed');
  const techStack = [
    { name: t('devmanager.skills.developer_skills'), techs: skillMatrix.map((s) => s.skill) },
  ].filter((g) => g.techs.length);
  const projectEligibility = openTasks.filter((t) => stackOf(t).length).slice(0, 10).map((t) => {
    const required = stackOf(t);
    return {
      project: t.title,
      required,
      eligible: devs.filter((d) => required.every((r) => d.skillTags.some((s) => norm(s) === norm(r)))).length,
    };
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.skills.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.skills.subtitle')}</p>
      </div>

      {/* Skill Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            {t('devmanager.skills.matrix')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {skillMatrix.length === 0 && (
              <p
                className="text-sm text-muted-foreground"
                role="status"
                aria-live="polite"
                aria-busy={registry.isLoading || undefined}
              >
                {registry.isLoading ? t('devmanager.common.loading') : t('devmanager.skills.matrix_empty')}
              </p>
            )}
            {skillMatrix.map((skill) => (
              <div key={skill.skill} className="flex items-center gap-4">
                <div className="w-24">
                  <span className="font-medium">{skill.skill}</span>
                </div>
                <div className="flex-1">
                  <Progress value={skill.coverage} className="h-2" aria-label={skill.skill} />
                </div>
                <div className="w-20 text-right">
                  <span className="text-sm text-muted-foreground">{t('devmanager.skills.devs', { count: skill.developers })}</span>
                </div>
                <Badge variant="outline">{skill.level}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tech Stack */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              {t('devmanager.skills.tech_stack')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {techStack.length === 0 && (
                <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                  {t('devmanager.skills.tech_stack_empty')}
                </p>
              )}
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
              {t('devmanager.skills.eligibility')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projectEligibility.length === 0 && (
                <p
                  className="text-sm text-muted-foreground"
                  role="status"
                  aria-live="polite"
                  aria-busy={tasks.isLoading || undefined}
                >
                  {tasks.isLoading ? t('devmanager.common.loading') : t('devmanager.skills.eligibility_empty')}
                </p>
              )}
              {projectEligibility.map((project) => (
                <div key={project.project} className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium mb-2">{project.project}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {project.required.map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">{t('devmanager.skills.eligible', { count: project.eligible })}</span>
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
            {t('devmanager.skills.ai_match')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-5xl font-bold text-purple-500 mb-2">—</div>
            <p className="text-sm text-muted-foreground">{t('devmanager.skills.ai_match_none')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMRoleSkillMapping;
