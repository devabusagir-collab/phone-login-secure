import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wifi, Ticket, Smartphone, ShieldCheck } from "lucide-react";
import logo from "@/assets/tadikko-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandHeader } from "@/components/BrandHeader";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/phone";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ta Dikko Riders Hotspot — Buy Wi-Fi Tickets Online" },
      {
        name: "description",
        content:
          "Buy Ta Dikko Riders hotspot Wi-Fi tickets from anywhere. Pay online or by USSD and get your PIN instantly.",
      },
      { property: "og:title", content: "Ta Dikko Riders Hotspot — Buy Wi-Fi Tickets Online" },
      {
        property: "og:description",
        content: "Pay online or by USSD and get your hotspot PIN instantly.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: packages } = useQuery({
    queryKey: ["public-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("id, name, description, duration_label, price")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen">
      <BrandHeader />
      <div className="brand-stripe h-1 w-full" />

      <section className="hero-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-gold-foreground">
              Connect. Stream. Enjoy.
            </span>
            <h1 className="mt-5 text-4xl font-extrabold uppercase leading-[1.05] text-primary-foreground sm:text-5xl">
              Buy your hotspot ticket
              <span className="block text-brand-gold">from anywhere</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-primary-foreground/80">
              No need to stand at the hotspot. Pick a plan, pay with your phone, and get your Wi-Fi PIN
              right away. Use it any time at Ta Dikko Riders.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Get a ticket</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/dashboard">View plans</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-2xl bg-background/95 p-6 shadow-2xl">
            <img src={logo.url} alt="Ta Dikko Riders Hotspot & Entertainment" className="w-full" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-extrabold uppercase">Plans</h2>
        <p className="mt-1 text-sm text-muted-foreground">Prices are per ticket PIN.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(packages ?? []).map((p) => (
            <Card key={p.id} className="border-t-4 border-t-brand-red">
              <CardContent className="pt-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-bold uppercase">{p.name}</h3>
                  <span className="text-xl font-extrabold text-brand-red">{naira(p.price)}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                <Button asChild className="mt-4 w-full">
                  <Link to="/dashboard">Buy now</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Smartphone, title: "Phone + PIN login", text: "Sign in with your phone number and a 4-digit PIN." },
            { icon: Ticket, title: "Instant PIN", text: "Your ticket appears the moment payment is confirmed." },
            { icon: Wifi, title: "Use it any time", text: "Enter the PIN at the hotspot whenever you're ready." },
            { icon: ShieldCheck, title: "Safe records", text: "Every ticket you buy stays saved in My Tickets." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl bg-card p-5 shadow-sm">
              <f.icon className="h-6 w-6 text-brand-red" />
              <h3 className="mt-3 font-bold uppercase">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Ta Dikko Riders Hotspot & Entertainment.
        </div>
      </footer>
    </div>
  );
}
