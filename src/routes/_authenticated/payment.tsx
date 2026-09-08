import { useEffect, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandHeader } from "@/components/BrandHeader";
import { completePurchase } from "@/lib/sales.functions";

export const Route = createFileRoute("/_authenticated/payment")({
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search["ref"] === "string" ? search["ref"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Payment — Ta Dikko Riders" },
      { name: "description", content: "Confirming your hotspot ticket payment." },
      { property: "og:title", content: "Payment — Ta Dikko Riders" },
      { property: "og:description", content: "Confirming your hotspot ticket payment." },
    ],
  }),
  component: PaymentPage,
});

function PaymentPage() {
  const { ref } = useSearch({ from: "/_authenticated/payment" });
  const complete = useServerFn(completePurchase);
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [pin, setPin] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ref) {
      setState("failed");
      setMessage("No payment reference was provided.");
      return;
    }
    complete({ data: { reference: ref } })
      .then((res) => {
        setPin(res.pin);
        setState("done");
      })
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "We could not confirm this payment.");
        setState("failed");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  return (
    <div className="min-h-screen">
      <BrandHeader />
      <div className="brand-stripe h-1 w-full" />
      <main className="mx-auto max-w-lg px-4 py-14">
        <Card>
          <CardContent className="py-8 text-center">
            {state === "working" && <p>Confirming your payment…</p>}
            {state === "done" && (
              <>
                <h1 className="text-xl font-extrabold uppercase">Payment confirmed</h1>
                <p className="mt-2 text-sm text-muted-foreground">Your ticket PIN is</p>
                <p className="mt-3 font-mono text-3xl font-bold tracking-[0.2em]">{pin}</p>
                <Button asChild className="mt-6">
                  <Link to="/tickets">Go to my tickets</Link>
                </Button>
              </>
            )}
            {state === "failed" && (
              <>
                <h1 className="text-xl font-extrabold uppercase">Not confirmed</h1>
                <p className="mt-2 text-sm text-muted-foreground">{message}</p>
                <Button asChild variant="outline" className="mt-6">
                  <Link to="/dashboard">Back to plans</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
