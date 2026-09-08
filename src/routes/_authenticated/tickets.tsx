import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandHeader } from "@/components/BrandHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/tickets")({
  head: () => ({
    meta: [
      { title: "My tickets — Ta Dikko Riders" },
      { name: "description", content: "All the hotspot ticket PINs you have bought." },
      { property: "og:title", content: "My tickets — Ta Dikko Riders" },
      { property: "og:description", content: "All the hotspot ticket PINs you have bought." },
    ],
  }),
  component: MyTickets,
});

function MyTickets() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, pin, sold_at, packages(name, duration_label)")
        .eq("status", "sold")
        .order("sold_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen">
      <BrandHeader />
      <div className="brand-stripe h-1 w-full" />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-extrabold uppercase">My tickets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a PIN on the hotspot Wi-Fi page to get online.
        </p>

        {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (data ?? []).length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">You have not bought any tickets yet.</p>
        )}

        <div className="mt-6 space-y-3">
          {(data ?? []).map((t) => (
            <Card key={t.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.packages?.name} · {t.packages?.duration_label}
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em]">{t.pin}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.sold_at ? new Date(t.sold_at).toLocaleString() : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(t.pin);
                    toast.success("PIN copied");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
