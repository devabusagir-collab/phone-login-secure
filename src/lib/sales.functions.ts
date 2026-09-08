import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function makeReference() {
  return "TDK-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Start a purchase. Returns a payment link when the gateway is configured,
 *  otherwise a manual-confirm order (test mode). */
export const startPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { packageId: string; origin: string }) => {
    if (!input?.packageId) throw new Error("Package is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from("packages")
      .select("id, name, price, is_active")
      .eq("id", data.packageId)
      .maybeSingle();
    if (pkgErr || !pkg || !pkg.is_active) throw new Error("This package is not available");

    const { count } = await supabaseAdmin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("package_id", pkg.id)
      .eq("status", "available");
    if (!count) throw new Error("Sorry, this package is sold out right now");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("id", context.userId)
      .maybeSingle();

    const reference = makeReference();
    const { error: orderErr } = await supabaseAdmin.from("orders").insert({
      user_id: context.userId,
      package_id: pkg.id,
      amount: pkg.price,
      reference,
      channel: "web",
      phone: profile?.phone ?? null,
    });
    if (orderErr) throw new Error("Could not start this purchase");

    const secret = process.env["PAYSTACK_SECRET_KEY"];
    if (!secret) {
      return { reference, authorizationUrl: null as string | null, testMode: true };
    }

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${profile?.phone ?? context.userId}@tadikkoriders.app`,
        amount: Math.round(Number(pkg.price) * 100),
        reference,
        callback_url: `${data.origin}/payment?ref=${reference}`,
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`Paystack init failed [${res.status}]: ${body}`);
      throw new Error("Payment could not be started. Please try again.");
    }
    const json = JSON.parse(body) as { data?: { authorization_url?: string } };
    return {
      reference,
      authorizationUrl: json.data?.authorization_url ?? null,
      testMode: false,
    };
  });

/** Verify payment (or confirm in test mode) and release a ticket PIN. */
export const completePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    if (!input?.reference) throw new Error("Reference is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, status, reference")
      .eq("reference", data.reference)
      .maybeSingle();
    if (!order || order.user_id !== context.userId) throw new Error("Order not found");

    const secret = process.env["PAYSTACK_SECRET_KEY"];
    if (secret && order.status !== "paid") {
      const res = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(order.reference)}`,
        { headers: { Authorization: `Bearer ${secret}` } },
      );
      const body = await res.text();
      if (!res.ok) {
        console.error(`Paystack verify failed [${res.status}]: ${body}`);
        throw new Error("We could not confirm your payment yet");
      }
      const json = JSON.parse(body) as { data?: { status?: string } };
      if (json.data?.status !== "success") throw new Error("Payment was not completed");
    }

    const { data: assigned, error } = await supabaseAdmin.rpc("assign_ticket", {
      _order_id: order.id,
    });
    if (error) {
      console.error("assign_ticket failed", error);
      throw new Error(error.message || "Could not release a ticket");
    }
    const pin = Array.isArray(assigned) ? assigned[0]?.pin : null;
    return { pin: pin as string | null };
  });

/** One-time promotion of the current account to administrator. */
export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const expected = process.env["ADMIN_SETUP_CODE"];
    if (!expected || data.code !== expected) throw new Error("Invalid setup code");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error && !error.message.includes("duplicate")) throw new Error("Could not grant access");
    return { ok: true };
  });
