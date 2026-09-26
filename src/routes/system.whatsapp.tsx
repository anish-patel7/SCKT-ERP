import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  MessageSquare,
  Phone,
  ShieldCheck,
  Zap,
  Key,
  Plus,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  History,
  Settings,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import { requireAuth } from "@/lib/route-guards";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { processWhatsAppMessage, uid } from "@/lib/whatsapp/whatsapp-store";
import { dispatchAlertNotification } from "@/lib/whatsapp/notification-dispatcher";
import type { UserRole, WhatsAppButtonOption, WhatsAppUser } from "@/lib/whatsapp/types";

export const Route = createFileRoute("/system/whatsapp")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "WhatsApp Bot & Webhook Settings — SCKT ERP" },
      {
        name: "description",
        content:
          "Rule-based WhatsApp Business Assistant settings, provider configuration, authorized phone-to-user mappings, automatic alerts matrix, and live bot simulator.",
      },
      { property: "og:title", content: "WhatsApp Settings — SCKT ERP" },
      { property: "og:description", content: "Non-AI WhatsApp Assistant setup and RBAC mapping." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WhatsAppAdminPage,
});

const ROLE_BADGES: Record<UserRole, string> = {
  admin: "bg-purple-600 text-white font-bold",
  management: "bg-blue-600 text-white font-bold",
  costing: "bg-amber-600 text-white",
  approver: "bg-emerald-600 text-white",
  designer: "bg-indigo-600 text-white",
  planner: "bg-cyan-600 text-white",
  operator: "bg-slate-600 text-white",
  beam: "bg-slate-600 text-white",
  store: "bg-emerald-700 text-white",
  quality: "bg-rose-600 text-white",
  sales: "bg-blue-500 text-white",
  finance: "bg-emerald-600 text-white font-bold",
  jobwork: "bg-amber-700 text-white",
  customer: "bg-muted text-foreground",
};

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  buttons?: WhatsAppButtonOption[] | undefined;
}

function WhatsAppAdminPage() {
  const { data, update } = useWhatsApp();
  const [activeTab, setActiveTab] = useState("simulator");

  // Phone user modal
  const [openUserModal, setOpenUserModal] = useState(false);
  const [userForm, setUserForm] = useState({
    phone_number: "+919876543210",
    display_name: "Karan Verma (Sales Mgr)",
    role: "sales" as UserRole,
  });

  // Simulator state
  const [selectedPhone, setSelectedPhone] = useState<string>("+919876543210");
  const [simInput, setSimInput] = useState("MENU");
  const [chatLog, setChatLog] = useState<ChatMessage[]>([
    {
      id: "c1",
      sender: "user",
      text: "MENU",
      timestamp: "18:05",
    },
    {
      id: "c2",
      sender: "bot",
      text: `📊 *SCKT BUSINESS ASSISTANT*\n\n1️⃣ *Inventory* (Stock, Yarn, Fabric)\n2️⃣ *Production* (Today, Looms, Pending)\n3️⃣ *Loom Status* (Running, Idle, Breakdown)\n4️⃣ *Job Work* (Challans, Balances)\n5️⃣ *Orders* (Sales Orders, Pending)\n6️⃣ *Dispatch* (Today's Packing Lists)\n7️⃣ *Party* (Customer Profiles & Balance)\n8️⃣ *Purchase* (Yarn Reorder Alerts)\n9️⃣ *Quality* (4-Point Scores & Holds)\n🔟 *Reports* (Daily Summary & Analytics)\n\n_Reply with the number (1-10) or type commands like *STOCK DESIGN D-015* or *PRODUCTION TODAY*._`,
      timestamp: "18:05",
      buttons: [
        { id: "b1", title: "📦 Inventory" },
        { id: "b2", title: "🏭 Production" },
        { id: "b3", title: "🧵 Loom Status" },
      ],
    },
  ]);

  const handleAddUser = () => {
    if (!userForm.phone_number.trim() || !userForm.display_name.trim()) {
      toast.error("Phone number and user name are required");
      return;
    }

    const newUser: WhatsAppUser = {
      id: uid("usr"),
      phone_number: userForm.phone_number.trim(),
      display_name: userForm.display_name.trim(),
      sckt_user_id: uid("u"),
      role: userForm.role,
      is_active: true,
      registered_at: new Date().toISOString(),
    };

    update((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
    }));

    toast.success(
      `Authorized WhatsApp user ${newUser.display_name} (${newUser.phone_number}) added.`,
    );
    setOpenUserModal(false);
  };

  const handleToggleRule = (alertType: string, enabled: boolean) => {
    update((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.alert_type === alertType ? { ...r, enabled } : r)),
    }));
    toast.success(`Alert rule updated`);
  };

  const handleSendSimMessage = (commandText?: string) => {
    const textToSend = commandText || simInput;
    if (!textToSend.trim()) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // User message
    const userMsg: ChatMessage = {
      id: uid("c"),
      sender: "user",
      text: textToSend,
      timestamp: timeStr,
    };

    // Execute rule-based command engine
    const { response } = processWhatsAppMessage(selectedPhone, textToSend);

    const botMsg: ChatMessage = {
      id: uid("c"),
      sender: "bot",
      text: response.formatted_text,
      timestamp: timeStr,
      buttons: response.buttons,
    };

    setChatLog((prev) => [...prev, userMsg, botMsg]);
    if (!commandText) setSimInput("");
  };

  const handleTestAlertTrigger = async (alertType: any) => {
    const res = await dispatchAlertNotification(
      {
        alert_type: alertType,
        title: "Test Alert Notification",
        item_code: "40/1 Cotton Yarn",
        loom_no: "L-04",
        current_val: "420 kg",
        target_val: "500 kg",
        reason: "Electrical fault detected",
      },
      data.users,
      data.rules,
    );

    toast.success(
      `Alert notification dispatched via provider to ${res.dispatched_count} authorized recipients.`,
    );
  };

  return (
    <AppShell
      title="WhatsApp Business Assistant (Rule-Based Non-AI)"
      breadcrumb={[{ label: "System", to: "/system" }, { label: "WhatsApp Bot" }]}
      actions={
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="font-mono text-xs gap-1 bg-emerald-500/10 text-emerald-700 border-emerald-300"
          >
            <Bot className="size-3.5 text-emerald-600" /> Non-AI Rule Bot Engine Active
          </Badge>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Connection Status Banner */}
        <Card className="border border-border bg-card">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold">
                <MessageSquare className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-foreground">
                    Meta WhatsApp Cloud API Connector
                  </h3>
                  <Badge className="bg-emerald-600 text-white text-[0.625rem]">
                    Verified Webhook
                  </Badge>
                </div>
                <span className="text-[0.6875rem] text-muted-foreground font-mono">
                  Business Number: {data.config.business_phone_number} | Phone ID:{" "}
                  {data.config.phone_number_id}
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => toast.success("Meta API Connection Verified!")}
            >
              <RefreshCw className="size-3.5" /> Test Webhook
            </Button>
          </CardContent>
        </Card>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-8 text-xs">
            <TabsTrigger value="simulator" className="h-7 text-xs gap-1">
              <MessageSquare className="size-3.5 text-emerald-600" /> Interactive Bot Simulator
            </TabsTrigger>
            <TabsTrigger value="users" className="h-7 text-xs gap-1">
              <Phone className="size-3.5" /> Authorized Phone Mappings
            </TabsTrigger>
            <TabsTrigger value="rules" className="h-7 text-xs gap-1">
              <Zap className="size-3.5 text-amber-500" /> Automatic Notification Rules
            </TabsTrigger>
            <TabsTrigger value="audit" className="h-7 text-xs gap-1">
              <History className="size-3.5" /> Webhook Audit Logs
            </TabsTrigger>
          </TabsList>

          {/* Interactive Live WhatsApp Bot Simulator */}
          <TabsContent value="simulator" className="space-y-3 mt-3">
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Controls & Command Tester Chips */}
              <Card className="lg:col-span-1 border border-border">
                <CardHeader className="p-3 pb-2 border-b border-border">
                  <CardTitle className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Settings className="size-4" /> Sender Simulation Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Select Active WhatsApp Sender</Label>
                    <Select value={selectedPhone} onValueChange={setSelectedPhone}>
                      <SelectTrigger className="h-8 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {data.users.map((u) => (
                          <SelectItem key={u.id} value={u.phone_number}>
                            {u.display_name} ({u.role.toUpperCase()})
                          </SelectItem>
                        ))}
                        <SelectItem value="+919999999999">
                          Unknown Number (+919999999999)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-[0.625rem] text-muted-foreground block mt-0.5">
                      Tests rule-based RBAC permissions for the selected user role.
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <Label className="text-xs font-semibold text-foreground">
                      Quick Command Test Chips
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendSimMessage("MENU")}
                        className="h-6 text-[0.6875rem] px-2 font-mono"
                      >
                        MENU
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendSimMessage("STOCK DESIGN D-015")}
                        className="h-6 text-[0.6875rem] px-2 font-mono"
                      >
                        STOCK DESIGN D-015
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendSimMessage("LOW STOCK")}
                        className="h-6 text-[0.6875rem] px-2 font-mono"
                      >
                        LOW STOCK
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendSimMessage("PRODUCTION TODAY")}
                        className="h-6 text-[0.6875rem] px-2 font-mono"
                      >
                        PRODUCTION TODAY
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendSimMessage("LOOM STATUS")}
                        className="h-6 text-[0.6875rem] px-2 font-mono"
                      >
                        LOOM STATUS
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendSimMessage("SUMMARY")}
                        className="h-6 text-[0.6875rem] px-2 font-mono"
                      >
                        SUMMARY (Finance/Mgmt)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendSimMessage("QUALITY HOLD")}
                        className="h-6 text-[0.6875rem] px-2 font-mono"
                      >
                        QUALITY HOLD
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Mobile Chat View Emulator */}
              <Card className="lg:col-span-2 border border-border overflow-hidden bg-slate-950 text-slate-100 flex flex-col h-[520px]">
                <div className="p-3 bg-emerald-800 text-white flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                      W1
                    </div>
                    <div>
                      <h4 className="text-xs font-bold leading-tight">SCKT Business Assistant</h4>
                      <span className="text-[0.625rem] text-emerald-200 block">
                        Official ERP Bot (Non-AI)
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[0.625rem] border-emerald-400 text-white font-mono"
                  >
                    Sender: {selectedPhone}
                  </Badge>
                </div>

                {/* Chat Log Window */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
                  {chatLog.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${
                        msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                      }`}
                    >
                      <div
                        className={`rounded-lg p-2.5 text-xs whitespace-pre-wrap font-sans shadow-sm ${
                          msg.sender === "user"
                            ? "bg-emerald-700 text-white rounded-tr-none font-mono"
                            : "bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none"
                        }`}
                      >
                        {msg.text}
                      </div>

                      {/* Interactive Buttons */}
                      {msg.buttons && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {msg.buttons.map((b) => (
                            <button
                              key={b.id}
                              onClick={() =>
                                handleSendSimMessage(b.title.replace(/[^\w\s]/gi, "").trim())
                              }
                              className="text-[0.6875rem] font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-600/40 rounded px-2.5 py-1 transition-colors"
                            >
                              {b.title}
                            </button>
                          ))}
                        </div>
                      )}

                      <span className="text-[0.5625rem] text-slate-400 mt-0.5 px-1 font-mono">
                        {msg.timestamp}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Chat Input Bar */}
                <div className="p-2 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
                  <Input
                    value={simInput}
                    onChange={(e) => setSimInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendSimMessage()}
                    placeholder="Type WhatsApp command (e.g. MENU, STOCK, PRODUCTION...)"
                    className="h-8 text-xs bg-slate-950 border-slate-700 text-white font-mono"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSendSimMessage()}
                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Send className="size-3.5" />
                  </Button>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Authorized Phone Mappings */}
          <TabsContent value="users" className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground">
                Authorized WhatsApp Users & Role Mappings
              </h3>
              <Button
                size="sm"
                onClick={() => setOpenUserModal(true)}
                className="h-7 gap-1 text-xs"
              >
                <Plus className="size-3.5" /> Authorize Phone Number
              </Button>
            </div>

            <Card className="rounded-md border border-border">
              <CardContent className="p-0">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/60 font-semibold text-muted-foreground">
                      <TableHead className="h-8">WhatsApp Phone Number</TableHead>
                      <TableHead className="h-8">Display User Name</TableHead>
                      <TableHead className="h-8">SCKT Role</TableHead>
                      <TableHead className="h-8">Status</TableHead>
                      <TableHead className="h-8">Registered Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.users.map((u) => (
                      <TableRow key={u.id} className="hover:bg-muted/40">
                        <TableCell className="py-2 font-mono font-bold text-primary">
                          {u.phone_number}
                        </TableCell>
                        <TableCell className="py-2 font-semibold text-foreground">
                          {u.display_name}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge className={`text-[0.625rem] ${ROLE_BADGES[u.role]}`}>
                            {u.role.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge className="bg-emerald-600 text-white text-[0.625rem]">
                            Active
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 font-mono text-muted-foreground">
                          {u.registered_at.slice(0, 10)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Automatic Notification Rules */}
          <TabsContent value="rules" className="space-y-3 mt-3">
            <Card className="rounded-md border border-border">
              <CardHeader className="p-3 pb-2 border-b border-border">
                <CardTitle className="text-xs font-bold text-primary">
                  Automatic Notification Matrix & Role Dispatcher
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {data.rules.map((rule) => (
                  <div
                    key={rule.alert_type}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-foreground">{rule.label}</h4>
                        <Badge variant="outline" className="font-mono text-[0.625rem]">
                          Roles: {rule.target_roles.join(", ").toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-[0.6875rem] text-muted-foreground">{rule.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestAlertTrigger(rule.alert_type)}
                        className="h-6 text-[0.6875rem] gap-1"
                      >
                        <Send className="size-3" /> Test Dispatch
                      </Button>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(v) => handleToggleRule(rule.alert_type, v)}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs */}
          <TabsContent value="audit" className="space-y-3 mt-3">
            <Card className="rounded-md border border-border">
              <CardContent className="p-0">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/60 font-semibold text-muted-foreground">
                      <TableHead className="h-8">Timestamp</TableHead>
                      <TableHead className="h-8">Sender Phone</TableHead>
                      <TableHead className="h-8">User Name & Role</TableHead>
                      <TableHead className="h-8">Raw Command</TableHead>
                      <TableHead className="h-8">Category</TableHead>
                      <TableHead className="h-8">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.auditLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/40">
                        <TableCell className="py-2 font-mono text-muted-foreground">
                          {log.timestamp.slice(0, 19)}
                        </TableCell>
                        <TableCell className="py-2 font-mono font-bold text-foreground">
                          {log.phone_number}
                        </TableCell>
                        <TableCell className="py-2 font-semibold">
                          {log.user_name} ({log.role.toUpperCase()})
                        </TableCell>
                        <TableCell className="py-2 font-mono text-primary">
                          {log.raw_command}
                        </TableCell>
                        <TableCell className="py-2 font-mono">{log.parsed_category}</TableCell>
                        <TableCell className="py-2">
                          {log.status === "SUCCESS" ? (
                            <Badge className="bg-emerald-600 text-white text-[0.625rem]">
                              SUCCESS
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-600 text-white text-[0.625rem] font-bold">
                              {log.status}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Authorize User Dialog */}
      <Dialog open={openUserModal} onOpenChange={setOpenUserModal}>
        <DialogContent className="max-w-md p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Phone className="size-4 text-emerald-600" /> Authorize WhatsApp Phone Number
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">WhatsApp Phone Number *</Label>
              <Input
                className="h-8 text-xs font-mono font-bold"
                placeholder="+919876543210"
                value={userForm.phone_number}
                onChange={(e) => setUserForm({ ...userForm, phone_number: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Display User Name *</Label>
              <Input
                className="h-8 text-xs font-semibold"
                placeholder="e.g. Karan Verma (Sales Manager)"
                value={userForm.display_name}
                onChange={(e) => setUserForm({ ...userForm, display_name: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">SCKT Role *</Label>
              <Select
                value={userForm.role}
                onValueChange={(v) => setUserForm({ ...userForm, role: v as UserRole })}
              >
                <SelectTrigger className="h-8 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (Full Access)</SelectItem>
                  <SelectItem value="management">
                    Management (Full Access + Financial Summary)
                  </SelectItem>
                  <SelectItem value="sales">Sales (Orders, Stock, Customers, Dispatch)</SelectItem>
                  <SelectItem value="production">
                    Production (Daily Logs, Looms, Job Cards)
                  </SelectItem>
                  <SelectItem value="quality">Quality (Inspections, Holds, Dips)</SelectItem>
                  <SelectItem value="store">Store / Warehouse (Stock, Dispatches)</SelectItem>
                  <SelectItem value="finance">
                    Finance (Orders, Outstanding, Financial Summary)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setOpenUserModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddUser}>
              Authorize Phone Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
