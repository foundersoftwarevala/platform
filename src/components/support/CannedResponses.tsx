import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, Plus, Search, Edit2, Trash2, Copy, 
  Star, Tag, Filter, CheckCircle, FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { relativeTime, useCannedResponses } from '@/hooks/useSalesSupportData';

// canned_responses is not in the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cannedTable = () => (supabase as any).from('canned_responses');

/** An agent's own favourites, kept in their browser: a preference, not shared data. */
const FAVOURITES_KEY = 'sv.support.canned.favourites';
function readFavourites(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FAVOURITES_KEY) ?? '[]') as string[]); } catch { return new Set(); }
}

interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  usageCount: number;
  isFavorite: boolean;
  lastUsed: string;
}

/**
 * Canned responses, from canned_responses.
 *
 * Six invented templates with invented usage counts were kept in the browser;
 * "New Response" said an editor "would open here", the edit button did nothing
 * and delete removed the browser's copy. The templates are the table's now:
 * copying one counts a use, and new, edit and delete change the table.
 */
const CannedResponses = () => {
  const queryClient = useQueryClient();
  const { data: rows, isLoading, error } = useCannedResponses();
  const [searchQuery, setSearchQuery] = useState('');
  const [favourites, setFavourites] = useState<Set<string>>(() => readFavourites());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responses: CannedResponse[] = ((rows ?? []) as any[]).map((r) => ({
    id: r.id,
    title: r.title ?? '',
    content: r.body ?? '',
    category: r.category ?? 'General',
    tags: r.shortcut ? [r.shortcut] : [],
    usageCount: Number(r.usage_count ?? 0),
    isFavorite: favourites.has(r.id),
    lastUsed: relativeTime(r.updated_at),
  }));

  const categories = ['All', ...new Set(responses.map((r) => r.category))];
  const [activeCategory, setActiveCategory] = useState('All');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['canned_responses'] });
  const run = async (work: PromiseLike<{ error: { message: string } | null }>, done: string) => {
    const { error: failed } = await work;
    if (failed) { toast.error(failed.message); return; }
    toast.success(done);
    await refresh();
  };

  const handleCopy = useCallback(async (response: CannedResponse) => {
    await navigator.clipboard?.writeText(response.content);
    toast.success('Copied to clipboard');
    // Counting the use is best effort; the copy has already happened.
    await cannedTable().update({ usage_count: response.usageCount + 1, updated_at: new Date().toISOString() }).eq('id', response.id);
    await refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleFavorite = useCallback((id: string) => {
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(FAVOURITES_KEY, JSON.stringify([...next])); } catch { /* favourites for this visit only */ }
      return next;
    });
  }, []);

  const handleCreate = useCallback(async () => {
    const title = window.prompt('Title of the new response')?.trim();
    if (!title) return;
    const body = window.prompt('The response text')?.trim();
    if (!body) return;
    const category = window.prompt('Category', activeCategory === 'All' ? 'General' : activeCategory)?.trim() || 'General';
    await run(cannedTable().insert({ title, body, category }), 'Response saved');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  const handleEdit = async (response: CannedResponse) => {
    const body = window.prompt(`Edit "${response.title}"`, response.content)?.trim();
    if (!body || body === response.content) return;
    await run(cannedTable().update({ body, updated_at: new Date().toISOString() }).eq('id', response.id), 'Response updated');
  };

  const handleDelete = useCallback(async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    await run(cannedTable().delete().eq('id', id), 'Response deleted');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredResponses = responses.filter(r => {
    const matchesCategory = activeCategory === 'All' || r.category === activeCategory;
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-teal-400" />
            Canned Responses
          </h2>
          <p className="text-muted-foreground text-sm">Pre-written templates for faster replies</p>
        </div>
        <Button onClick={handleCreate} className="bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30">
          <Plus className="w-4 h-4 mr-2" />
          New Response
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search responses..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card/60 border-border"
          />
        </div>
        <div className="flex items-center gap-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={activeCategory === cat ? 'default' : 'ghost'}
              onClick={() => setActiveCategory(cat)}
              className={activeCategory === cat 
                ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' 
                : 'text-muted-foreground hover:text-foreground'
              }
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Response Cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {(isLoading || error || filteredResponses.length === 0) && (
          <p className="col-span-full text-sm text-muted-foreground">
            {isLoading ? 'Loading responses…' : error ? `Responses could not be read: ${(error as Error).message}` : 'No saved response here yet.'}
          </p>
        )}
        {filteredResponses.map((response, idx) => (
          <motion.div
            key={response.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ scale: 1.01 }}
            className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-xl p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => handleToggleFavorite(response.id)}
                  className={response.isFavorite ? 'text-yellow-400' : 'text-muted-foreground'}
                >
                  <Star className={`w-4 h-4 ${response.isFavorite ? 'fill-current' : ''}`} />
                </Button>
                <div>
                  <h4 className="font-semibold text-foreground">{response.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-muted/40 text-muted-foreground text-xs">{response.category}</Badge>
                    <span className="text-xs text-muted-foreground">Used {response.usageCount} times</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => handleCopy(response)}
                  className="text-teal-400 hover:bg-teal-500/10"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Edit ${response.title}`} onClick={() => void handleEdit(response)} className="text-muted-foreground hover:text-foreground">
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => handleDelete(response.id, response.title)}
                  className="text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{response.content}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 flex-wrap">
                {response.tags.map((tag) => (
                  <Badge key={tag} className="bg-teal-500/10 text-teal-400 text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">Last used: {response.lastUsed}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-4 gap-4"
      >
        {[
          { label: 'Total Responses', value: responses.length, icon: FolderOpen, color: 'text-teal-400' },
          { label: 'Favorites', value: responses.filter(r => r.isFavorite).length, icon: Star, color: 'text-yellow-400' },
          { label: 'Categories', value: categories.length - 1, icon: Tag, color: 'text-purple-400' },
          { label: 'Total Uses', value: responses.reduce((sum, r) => sum + r.usageCount, 0), icon: CheckCircle, color: 'text-emerald-400' },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default CannedResponses;
