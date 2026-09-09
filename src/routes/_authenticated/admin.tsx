import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BrandHeader } from "@/components/BrandHeader";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/lib/session";
import { displayPhone, naira } from "@/lib/phone";
import { claimAdmin } from "@/lib/sales.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Ta Dikko Riders Hotspot" },
      { name: "description", content: "Manage plans, ticket PIN inventory, sales and customers." },
      { property: "og:title", content: "Admin — Ta Dikko Riders Hotspot" },
      { property: "og:description", content: "Manage plans, ticket inventory, sales and customers." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { session } = useSession();
  const isAdmin = useIsAdmin(session?.user.id);

  return (
    <div className="min-h-screen">
      <BrandHeader />
      <div className="brand-stripe h-1 w-full" />
      <main className="mx-auto max-w-6xl px-4 py-10">
        {isAdmin === null && <p className="text-sm text-muted-foreground">Checking access…</p>}
        {isAdmin === false && <ClaimAdmin />}
        {isAdmin && <AdminTabs />}
      </main>
    </div>
  );
}

function ClaimAdmin() {
  const claim = useServerFn(claimAdmin);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Administrator access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter the setup code to turn this account into an administrator.
        </p>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Setup code"
          maxLength={64}
        />
        <Button
          className="w-full"
          disabled={busy || !code}
          onClick={async () => {
            setBusy(true);
            try {
              await claim({ data: { code } });
              toast.success("You are now an administrator");
              window.location.reload();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not grant access");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Please wait…" : "Unlock admin"}
        </Button>
      </CardContent>
    </Card>
  );
}

function AdminTabs() {
  return (
    <>
      <h1 className="text-2xl font-extrabold uppercase">Admin dashboard</h1>
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tickets">Ticket PINs</TabsTrigger>
          <TabsTrigger value="packages">Plans</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-6">
          <Overview />
        </TabsContent>
        <TabsContent value="tickets" className="pt-6">
          <TicketsPanel />
        </TabsContent>
        <TabsContent value="packages" className="pt-6">
          <PackagesPanel />
        </TabsContent>
        <TabsContent value="sales" className="pt-6">
          <SalesPanel />
        </TabsContent>
        <TabsContent value="customers" className="pt-6">
          <CustomersPanel />
        </TabsContent>
      </Tabs>
    </>
  );
}

function usePackages() {
  return useQuery({
    queryKey: ["admin-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("id, name, description, duration_label, price, is_active, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

function Overview() {
  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [tickets, orders] = await Promise.all([
        supabase.from("tickets").select("status"),
        supabase.from("orders").select("status, amount"),
      ]);
      const t = tickets.data ?? [];
      const o = orders.data ?? [];
      const paid = o.filter((x) => x.status === "paid");
      return {
        available: t.filter((x) => x.status === "available").length,
        sold: t.filter((x) => x.status === "sold").length,
        orders: paid.length,
        revenue: paid.reduce((s, x) => s + Number(x.amount), 0),
      };
    },
  });

  const cards = [
    { label: "Tickets available", value: data?.available ?? 0 },
    { label: "Tickets sold", value: data?.sold ?? 0 },
    { label: "Paid orders", value: data?.orders ?? 0 },
    { label: "Revenue", value: naira(data?.revenue ?? 0) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="border-l-4 border-l-brand-gold">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-2 text-2xl font-extrabold">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TicketsPanel() {
  const qc = useQueryClient();
  const { data: packages } = usePackages();
  const [packageId, setPackageId] = useState("");
  const [pins, setPins] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: tickets } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, pin, status, sold_at, packages(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  async function upload() {
    const list = Array.from(
      new Set(
        pins
          .split(/[\s,;]+/)
          .map((p) => p.trim())
          .filter(Boolean),
      ),
    );
    if (!packageId || list.length === 0) {
      toast.error("Pick a plan and paste at least one PIN");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("tickets")
      .insert(list.map((pin) => ({ package_id: packageId, pin })));
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Some PINs already exist" : "Upload failed");
      return;
    }
    toast.success(`${list.length} ticket PINs added`);
    setPins("");
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload ticket PINs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={packageId} onValueChange={setPackageId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a plan" />
              </SelectTrigger>
              <SelectContent>
                {(packages ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {naira(p.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pins">PINs</Label>
            <Textarea
              id="pins"
              rows={6}
              placeholder={"58392017\n72918463\n91827364"}
              value={pins}
              onChange={(e) => setPins(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              One PIN per line. You can also paste a comma-separated list or a CSV column.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={upload} disabled={busy}>
              {busy ? "Uploading…" : "Add PINs"}
            </Button>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                Load from CSV file
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    setPins(text);
                    toast.success("File loaded — check the PINs then press Add PINs");
                  }}
                />
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PIN</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sold</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tickets ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono">{t.pin}</TableCell>
                  <TableCell>{t.packages?.name}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "available" ? "secondary" : "default"}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.sold_at ? new Date(t.sold_at).toLocaleDateString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PackagesPanel() {
  const qc = useQueryClient();
  const { data: packages } = usePackages();
  const [form, setForm] = useState({ name: "", duration_label: "", price: "", description: "" });

  async function addPackage() {
    if (!form.name || !form.duration_label || !form.price) {
      toast.error("Name, duration and price are required");
      return;
    }
    const { error } = await supabase.from("packages").insert({
      name: form.name,
      duration_label: form.duration_label,
      price: Number(form.price),
      description: form.description,
      sort_order: (packages?.length ?? 0) + 1,
    });
    if (error) {
      toast.error("Could not add the plan");
      return;
    }
    toast.success("Plan added");
    setForm({ name: "", duration_label: "", price: "", description: "" });
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a plan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Duration</Label>
            <Input
              placeholder="1 Day"
              value={form.duration_label}
              onChange={(e) => setForm({ ...form, duration_label: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Price (₦)</Label>
            <Input
              inputMode="numeric"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d.]/g, "") })}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <Button onClick={addPackage}>Add plan</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>On sale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(packages ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.duration_label}</TableCell>
                  <TableCell>{naira(p.price)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={p.is_active}
                      onCheckedChange={async (v) => {
                        await supabase.from("packages").update({ is_active: v }).eq("id", p.id);
                        qc.invalidateQueries();
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SalesPanel() {
  const { data } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, reference, amount, status, channel, phone, created_at, packages(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales & transactions</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.reference}</TableCell>
                <TableCell>{o.packages?.name}</TableCell>
                <TableCell>{o.phone ? displayPhone(o.phone) : "—"}</TableCell>
                <TableCell>{naira(o.amount)}</TableCell>
                <TableCell className="uppercase">{o.channel}</TableCell>
                <TableCell>
                  <Badge variant={o.status === "paid" ? "default" : "secondary"}>{o.status}</Badge>
                </TableCell>
                <TableCell>{new Date(o.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CustomersPanel() {
  const { data } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, phone, full_name, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customers</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.full_name || "—"}</TableCell>
                <TableCell>{displayPhone(c.phone)}</TableCell>
                <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
