import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  Phone,
  Mail,
  Video,
  User,
  Bell,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  useTasks,
  useCustomers,
  useTeamMembers,
  useInsertRow,
  useUpdateRow,
  useDeleteRow,
  memberName,
} from "@/hooks/useSalesSupportData";

const getTypeIcon = (type: string) => {
  switch (type) {
    case "call": return Phone;
    case "email": return Mail;
    case "meeting": return Video;
    default: return Circle;
  }
};

const formatDue = (dueAt: string | null) => {
  if (!dueAt) return "No due date";
  const due = new Date(dueAt);
  const now = new Date();
  const isToday = due.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = due.toDateString() === tomorrow.toDateString();
  const time = due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today, ${time}`;
  if (isTomorrow) return `Tomorrow, ${time}`;
  return due.toLocaleDateString([], { month: "short", day: "numeric" });
};

const TasksFollowups = () => {
  const { data: tasks, isLoading } = useTasks();
  const { data: customers } = useCustomers();
  const { data: members } = useTeamMembers();
  const insertTask = useInsertRow("crm_tasks");
  const updateTask = useUpdateRow("crm_tasks");
  const deleteTask = useDeleteRow("crm_tasks");

  const [filter, setFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    task_type: "call",
    customer_id: "",
    due_at: "",
    priority: "medium",
  });

  const allTasks = tasks ?? [];
  const customerName = (id: string | null) => (customers ?? []).find(c => c.id === id)?.company_name ?? memberName(members, id) ?? "—";

  const isOverdue = (t: (typeof allTasks)[number]) => t.due_at ? new Date(t.due_at).getTime() < Date.now() && t.status !== "completed" : false;
  const isCompleted = (t: (typeof allTasks)[number]) => t.status === "completed";

  const filteredTasks = allTasks.filter(task => {
    if (filter === "pending") return !isCompleted(task);
    if (filter === "completed") return isCompleted(task);
    if (filter === "overdue") return isOverdue(task);
    return true;
  });

  const todayTasks = allTasks.filter(t => t.due_at && new Date(t.due_at).toDateString() === new Date().toDateString() && !isCompleted(t));
  const overdueTasks = allTasks.filter(isOverdue);
  const completedTasks = allTasks.filter(isCompleted);

  const toggleTask = async (id: string, currentStatus: string) => {
    try {
      await updateTask.mutateAsync({ id, values: { status: currentStatus === "completed" ? "pending" : "completed" } });
    } catch (err) {
      toast({ title: "Update failed", description: String(err), variant: "destructive" });
    }
  };

  const handleCreateTask = async () => {
    if (!form.title) {
      toast({ title: "Missing fields", description: "Task title is required.", variant: "destructive" });
      return;
    }
    try {
      await insertTask.mutateAsync({
        title: form.title,
        task_type: form.task_type,
        customer_id: form.customer_id || null,
        due_at: form.due_at || null,
        priority: form.priority,
        status: "pending",
      });
      toast({ title: "Task created", description: `${form.title} was added.` });
      setForm({ title: "", task_type: "call", customer_id: "", due_at: "", priority: "medium" });
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Failed to create task", description: String(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks & Follow-ups</h1>
          <p className="text-muted-foreground mt-1">Stay on top of your activities</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-blue-500 hover:bg-blue-600" size="lg">
              <Plus className="w-5 h-5" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Task Title</Label>
                <Input placeholder="Enter task description" className="mt-1" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.task_type} onValueChange={(v) => setForm(f => ({ ...f, task_type: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Phone Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="task">General Task</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Customer</Label>
                <Select value={form.customer_id} onValueChange={(v) => setForm(f => ({ ...f, customer_id: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {(customers ?? []).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date & Time</Label>
                <Input type="datetime-local" className="mt-1" value={form.due_at} onChange={(e) => setForm(f => ({ ...f, due_at: e.target.value }))} />
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full bg-blue-500 hover:bg-blue-600" size="lg" onClick={handleCreateTask} disabled={insertTask.isPending}>
                {insertTask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Task"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border cursor-pointer hover:shadow-md" onClick={() => setFilter("all")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Circle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{allTasks.length}</p>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border cursor-pointer hover:shadow-md" onClick={() => setFilter("pending")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{todayTasks.length}</p>
                <p className="text-sm text-muted-foreground">Due Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border cursor-pointer hover:shadow-md" onClick={() => setFilter("overdue")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{overdueTasks.length}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border cursor-pointer hover:shadow-md" onClick={() => setFilter("completed")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{completedTasks.length}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reminder Alert */}
      {todayTasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200"
        >
          <div className="p-3 rounded-full bg-blue-500">
            <Bell className="w-5 h-5 text-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">You have {todayTasks.length} tasks due today</p>
            <p className="text-sm text-muted-foreground">Don't forget to complete your pending follow-ups</p>
          </div>
          <Button variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-50" onClick={() => setFilter("pending")}>
            View All
          </Button>
        </motion.div>
      )}

      {/* Task List */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">
              {filter === "all" ? "All Tasks" :
               filter === "pending" ? "Pending Tasks" :
               filter === "completed" ? "Completed Tasks" : "Overdue Tasks"}
            </CardTitle>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tasks</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-6 text-center">Loading tasks...</p>
          ) : filteredTasks.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">No tasks found.</p>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task, index) => {
                const TypeIcon = getTypeIcon(task.task_type);
                const completed = isCompleted(task);
                const overdue = isOverdue(task);
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-colors ${
                      completed
                        ? 'bg-surface opacity-60'
                        : overdue
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-surface hover:bg-surface-2'
                    }`}
                  >
                    <Checkbox
                      checked={completed}
                      onCheckedChange={() => toggleTask(task.id, task.status)}
                      className="w-5 h-5"
                    />

                    <div className={`p-2 rounded-lg ${
                      task.task_type === 'call' ? 'bg-green-100' :
                      task.task_type === 'email' ? 'bg-blue-100' : 'bg-purple-100'
                    }`}>
                      <TypeIcon className={`w-4 h-4 ${
                        task.task_type === 'call' ? 'text-green-600' :
                        task.task_type === 'email' ? 'text-blue-600' : 'text-purple-600'
                      }`} />
                    </div>

                    <div className="flex-1">
                      <p className={`font-medium ${completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {customerName(task.customer_id)}
                        </span>
                      </div>
                    </div>

                    <Badge className={`${
                      task.priority === 'high' ? 'bg-red-100 text-red-700' :
                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-surface-2 text-muted-foreground'
                    }`}>
                      {task.priority}
                    </Badge>

                    <div className={`flex items-center gap-2 text-sm ${
                      overdue && !completed ? 'text-red-600 font-medium' : 'text-muted-foreground'
                    }`}>
                      <Calendar className="w-4 h-4" />
                      {formatDue(task.due_at)}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-red-500"
                      onClick={async () => {
                        try {
                          await deleteTask.mutateAsync(task.id);
                          toast({ title: "Task removed" });
                        } catch (err) {
                          toast({ title: "Delete failed", description: String(err), variant: "destructive" });
                        }
                      }}
                    >
                      <Circle className="w-4 h-4" />
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TasksFollowups;
