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
import { useGlobalActions } from '@/hooks/useGlobalActions';

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

const CannedResponses = () => {
  const { executeAction } = useGlobalActions();
  const [searchQuery, setSearchQuery] = useState('');

  const [responses, setResponses] = useState<CannedResponse[]>([
    { id: '1', title: 'Welcome Greeting', content: 'Hello! Thank you for reaching out to our support team. I\'m here to help you with any questions or concerns you may have.', category: 'Greetings', tags: ['welcome', 'intro'], usageCount: 234, isFavorite: true, lastUsed: '2 min ago' },
    { id: '2', title: 'Password Reset Instructions', content: 'To reset your password, please follow these steps:\n1. Go to the login page\n2. Click "Forgot Password"\n3. Enter your email address\n4. Check your inbox for the reset link', category: 'Account', tags: ['password', 'reset', 'login'], usageCount: 189, isFavorite: true, lastUsed: '15 min ago' },
    { id: '3', title: 'Refund Processing', content: 'Your refund request has been received and is being processed. Please allow 5-7 business days for the amount to reflect in your account.', category: 'Billing', tags: ['refund', 'billing', 'payment'], usageCount: 156, isFavorite: false, lastUsed: '1 hour ago' },
    { id: '4', title: 'Order Status Check', content: 'I\'d be happy to check your order status for you. Could you please provide your order number so I can look this up for you?', category: 'Orders', tags: ['order', 'status', 'tracking'], usageCount: 145, isFavorite: false, lastUsed: '30 min ago' },
    { id: '5', title: 'Closing Message', content: 'Is there anything else I can help you with today? If not, thank you for contacting us and have a wonderful day!', category: 'Closings', tags: ['close', 'end', 'goodbye'], usageCount: 312, isFavorite: true, lastUsed: '5 min ago' },
    { id: '6', title: 'Technical Issue Escalation', content: 'I understand this is a technical issue that requires specialized attention. I\'m escalating this to our technical team who will contact you within 24 hours.', category: 'Technical', tags: ['escalation', 'technical', 'specialist'], usageCount: 78, isFavorite: false, lastUsed: '2 hours ago' },
  ]);

  const categories = ['All', 'Greetings', 'Account', 'Billing', 'Orders', 'Technical', 'Closings'];
  const [activeCategory, setActiveCategory] = useState('All');

  const handleCopy = useCallback(async (response: CannedResponse) => {
    navigator.clipboard.writeText(response.content);
    await executeAction({
      actionId: `copy_response_${response.id}`,
      actionType: 'read',
      entityType: 'action',
      entityId: response.id,
      metadata: { title: response.title },
      successMessage: 'Response copied to clipboard',
    });
    toast.success('Copied to clipboard');
  }, [executeAction]);

  const handleToggleFavorite = useCallback(async (id: string) => {
    setResponses(prev => prev.map(r => 
      r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
    ));
    await executeAction({
      actionId: `toggle_favorite_${id}`,
      actionType: 'toggle',
      entityType: 'action',
      entityId: id,
      successMessage: 'Favorites updated',
    });
  }, [executeAction]);

  const handleCreate = useCallback(async () => {
    await executeAction({
      actionId: 'create_canned_response',
      actionType: 'create',
      entityType: 'action',
      successMessage: 'Opening response editor',
    });
    toast.info('Response editor would open here');
  }, [executeAction]);

  const handleDelete = useCallback(async (id: string, title: string) => {
    await executeAction({
      actionId: `delete_response_${id}`,
      actionType: 'delete',
      entityType: 'action',
      entityId: id,
      metadata: { title },
      successMessage: 'Response deleted',
    });
    setResponses(prev => prev.filter(r => r.id !== id));
  }, [executeAction]);

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
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
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
          { label: 'Total Uses Today', value: '847', icon: CheckCircle, color: 'text-emerald-400' },
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
