import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { relativeTime, useWikiArticles } from '@/hooks/useSalesSupportData';
import { motion } from 'framer-motion';
import {
  BookOpen, Search, FileText, Video, ChevronRight, Star, Clock, Tag,
} from 'lucide-react';

// wiki_articles is not in the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wikiTable = () => (supabase as any).from('wiki_articles');

/**
 * The support knowledge base, from wiki_articles.
 *
 * Five invented articles with invented view counts and languages stood here,
 * and none could be opened. These are the published articles; opening one
 * shows it and counts the view.
 */
const SolutionWiki = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: rows, isLoading, error } = useWikiArticles();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const published = ((rows ?? []) as any[]).filter((r) => r.status === 'published');
  const articles = published.map((r) => ({
    id: String(r.id),
    title: String(r.title ?? ''),
    category: String(r.category ?? 'general'),
    type: 'article' as 'article' | 'video',
    views: Number(r.views ?? 0),
    helpful: Number(r.helpful_count ?? 0),
    lastUpdated: relativeTime(r.updated_at),
    summary: String(r.summary ?? ''),
    body: String(r.body ?? ''),
    featured: false,
  }));
  const featuredIds = new Set([...articles].sort((x, y) => y.views - x.views).slice(0, 3).map((x) => x.id));
  for (const article of articles) article.featured = featuredIds.has(article.id);
  const categories = [
    { id: 'all', label: 'All', count: articles.length },
    ...[...new Set(articles.map((x) => x.category))].map((c) => ({
      id: c, label: c.charAt(0).toUpperCase() + c.slice(1), count: articles.filter((x) => x.category === c).length,
    })),
  ];
  const open = async (id: string) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (!next) return;
    const article = articles.find((x) => x.id === id);
    // Counting the view is best effort; the article is already open.
    await wikiTable().update({ views: (article?.views ?? 0) + 1 }).eq('id', id);
    void queryClient.invalidateQueries({ queryKey: ['wiki_articles'] });
  };

  const filteredArticles = articles.filter(article => {
    if (selectedCategory !== 'all' && article.category !== selectedCategory) {
      return false;
    }
    if (searchQuery && !article.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-teal-400" />
            Solution Wiki
          </h2>
          <p className="text-muted-foreground mt-1">Knowledge base and solution templates</p>
        </div>
      </div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search solutions, scripts, tutorials..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-card/60 border border-border text-foreground placeholder-slate-500 focus:outline-none focus:border-teal-500/30 transition-colors"
        />
      </motion.div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <motion.button
            key={category.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
              selectedCategory === category.id
                ? 'bg-teal-500/20 border border-teal-500/30 text-teal-400'
                : 'bg-card/60 border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {category.label}
            <span className="ml-2 text-xs opacity-60">({category.count})</span>
          </motion.button>
        ))}
      </div>

      {/* Featured */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {articles.filter(a => a.featured).slice(0, 3).map((article, index) => (
          <motion.div
            key={article.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            whileHover={{ y: -2 }}
            onClick={() => void open(article.id)}
            className="p-5 rounded-2xl bg-gradient-to-br from-teal-500/5 to-sky-500/5 border border-teal-500/20 cursor-pointer group"
          >
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400">Featured</span>
            </div>
            <h4 className="text-foreground font-medium mb-2 group-hover:text-teal-400 transition-colors">
              {article.title}
            </h4>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {article.type === 'video' ? <Video className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                {article.type}
              </span>
              <span>{article.views} views</span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Articles List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        {(isLoading || error || filteredArticles.length === 0) && (
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading articles…' : error ? `Articles could not be read: ${(error as Error).message}` : 'No published article here yet.'}
          </p>
        )}
        {filteredArticles.map((article, index) => (
          <motion.div
            key={article.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.05 }}
            role="button"
            tabIndex={0}
            aria-expanded={openId === article.id}
            onClick={() => void open(article.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void open(article.id); } }}
            className="p-4 rounded-xl bg-card/60 border border-border hover:border-teal-500/20 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  article.type === 'video' ? 'bg-pink-500/10' : 'bg-teal-500/10'
                }`}>
                  {article.type === 'video' ? (
                    <Video className="w-5 h-5 text-pink-400" />
                  ) : (
                    <FileText className="w-5 h-5 text-teal-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-foreground font-medium group-hover:text-teal-400 transition-colors">
                    {article.title}
                  </h4>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {article.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {article.lastUpdated}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{article.views} views</p>
                  <p className="text-xs text-emerald-400">{article.helpful} found it helpful</p>
                </div>
                <ChevronRight className={`w-5 h-5 text-muted-foreground group-hover:text-teal-400 transition-all ${openId === article.id ? 'rotate-90' : ''}`} />
              </div>
            </div>
            {openId === article.id && (
              <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground whitespace-pre-wrap">
                {article.summary && <p className="mb-2 font-medium text-foreground">{article.summary}</p>}
                {article.body || 'This article has no text yet.'}
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export default SolutionWiki;
