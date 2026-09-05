import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, Search, FileText, Video, Globe, 
  ChevronRight, Star, Clock, Tag
} from 'lucide-react';

const categories = [
  { id: 'all', label: 'All', count: 156 },
  { id: 'pos', label: 'POS System', count: 42 },
  { id: 'erp', label: 'School ERP', count: 38 },
  { id: 'crm', label: 'Hospital CRM', count: 28 },
  { id: 'common', label: 'Common Issues', count: 48 },
];

const articles = [
  {
    id: 1,
    title: 'Invoice Generation Troubleshooting',
    category: 'POS System',
    type: 'article',
    views: 1240,
    helpful: 98,
    languages: ['English', 'Hindi', 'Marathi'],
    lastUpdated: '2 days ago',
    featured: true,
  },
  {
    id: 2,
    title: 'Student Data Import Guide',
    category: 'School ERP',
    type: 'video',
    views: 890,
    helpful: 94,
    languages: ['English', 'Hindi'],
    lastUpdated: '1 week ago',
    featured: true,
  },
  {
    id: 3,
    title: 'Patient Record Sync Issues',
    category: 'Hospital CRM',
    type: 'article',
    views: 560,
    helpful: 91,
    languages: ['English'],
    lastUpdated: '3 days ago',
    featured: false,
  },
  {
    id: 4,
    title: 'Dashboard Not Loading - Quick Fix',
    category: 'Common Issues',
    type: 'article',
    views: 2100,
    helpful: 96,
    languages: ['English', 'Hindi', 'Tamil'],
    lastUpdated: '1 day ago',
    featured: true,
  },
  {
    id: 5,
    title: 'Report Export Tutorial',
    category: 'Common Issues',
    type: 'video',
    views: 670,
    helpful: 89,
    languages: ['English', 'Hindi'],
    lastUpdated: '5 days ago',
    featured: false,
  },
];

const SolutionWiki = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredArticles = articles.filter(article => {
    if (selectedCategory !== 'all' && !article.category.toLowerCase().includes(selectedCategory)) {
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
        {filteredArticles.map((article, index) => (
          <motion.div
            key={article.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.05 }}
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
                      <Globe className="w-3 h-3" />
                      {article.languages.length} languages
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
                  <p className="text-xs text-emerald-400">{article.helpful}% helpful</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-teal-400 transition-colors" />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export default SolutionWiki;
