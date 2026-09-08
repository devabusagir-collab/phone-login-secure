import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrandHeader } from "@/components/BrandHeader";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/phone";
import { startPurchase, completePurchase } from "@/lib/sales.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Buy a hotspot ticket — Ta Dikko Riders" },
      { name: "description", content: "Choose a Wi-Fi plan and get your hotspot ticket PIN." },
      { property: "og:title", content: "Buy a hotspot ticket — Ta Dikko Riders" },
      { property: "og:description", content: "Choose a Wi-Fi plan and get your hotspot ticket PIN." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const start = useServerFn(startPurchase);
  const complete = useServerFn(completePurchase);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: packages, isLoading } = useQuery({
    queryKey: ["packages-with-stock"],
    queryFn: async () => {
      const [{ data: pkgs, error }, { data: stock }] = await Promise.all([
        supabase
          .from("packages")
          .select("id, name, description, duration_label, price")
          .eq("is_active", true)
          .order("sort_order"),
        supabase.from("tickets").select("package_id").eq("status", "available"),
      ]);
      if (error) throw error;
      const counts = new Map<string, number>();
      (stock ?? []).forEach((t) => counts.set(t.package_id, (counts.get(t.package_id) ?? 0) + 1));
      return (pkgs ?? []).map((p) => ({ ...p, available: counts.get(p.id) ?? 0 }));
    },
  });

  async function buy(packageId: string) {
    setBusyId(packageId);
    try {
      const res = await start({ data: { packageId, origin: window.location.origin } });
      if (res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
        return;
      }
      const done = await complete({ data: { reference: res.reference } });
      toast.success(`Your ticket PIN is ${done.pin}`);
      navigate({ to: "/tickets" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen">
      <BrandHeader />
      <div className="brand-stripe h-1 w-full" />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-extrabold uppercase">Choose a plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay and your ticket PIN is released to you straight away.
        </p>

        {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading plans…</p>}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(packages ?? []).map((p) => (
            <Card key={p.id} className="border-t-4 border-t-brand-red">
              <CardContent className="pt-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-bold uppercase">{p.name}</h2>
                  <span className="text-xl font-extrabold text-brand-red">{naira(p.price)}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-3">
                  {p.available > 0 ? (
                    <Badge variant="secondary">{p.available} tickets left</Badge>
                  ) : (
                    <Badge variant="destructive">Sold out</Badge>
                  )}
                </div>
                <Button
                  className="mt-4 w-full"
                  disabled={p.available === 0 || busyId === p.id}
                  onClick={() => buy(p.id)}
                >
                  {busyId === p.id ? "Please wait…" : "Buy ticket"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
