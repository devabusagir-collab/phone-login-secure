import { createFileRoute } from "@tanstack/react-router";
import { normalizePhone } from "@/lib/phone";

/**
 * USSD channel (Africa's Talking style).
 * The aggregator POSTs sessionId, phoneNumber and text; we reply with
 * "CON ..." to continue the session or "END ..." to close it.
 */
export const Route = createFileRoute("/api/public/ussd")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const reply = (body: string) =>
          new Response(body, { headers: { "Content-Type": "text/plain" } });

        let phoneNumber = "";
        let text = "";
        try {
          const contentType = request.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            const json = (await request.json()) as { phoneNumber?: string; text?: string };
            phoneNumber = json.phoneNumber ?? "";
            text = json.text ?? "";
          } else {
            const form = await request.formData();
            phoneNumber = String(form.get("phoneNumber") ?? "");
            text = String(form.get("text") ?? "");
          }
        } catch {
          return reply("END Sorry, we could not read your request.");
        }

        const phone = normalizePhone(phoneNumber);
        if (!phone) return reply("END We could not recognise your phone number.");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: packages } = await supabaseAdmin
          .from("packages")
          .select("id, name, price")
          .eq("is_active", true)
          .order("sort_order");
        const list = packages ?? [];
        if (list.length === 0) return reply("END No plans are on sale right now.");

        const steps = text.split("*").filter((s) => s !== "");

        if (steps.length === 0) {
          const menu = list.map((p, i) => `${i + 1}. ${p.name} - N${Number(p.price)}`).join("\n");
          return reply(`CON Ta Dikko Riders Hotspot\nChoose a plan:\n${menu}`);
        }

        const choice = Number(steps[0]);
        const pkg = list[choice - 1];
        if (!pkg) return reply("END That option is not on the list.");

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("phone", phone)
          .maybeSingle();

        const reference =
          "USSD-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

        const { data: order, error: orderError } = await supabaseAdmin
          .from("orders")
          .insert({
            user_id: profile?.id ?? null,
            package_id: pkg.id,
            amount: pkg.price,
            reference,
            channel: "ussd",
            phone,
          })
          .select("id")
          .maybeSingle();

        if (orderError || !order) return reply("END We could not start your order. Please try again.");

        if (process.env["PAYSTACK_SECRET_KEY"]) {
          return reply(
            `END Order ${reference} created for ${pkg.name} (N${Number(pkg.price)}).\nApprove the payment prompt, then dial again or open the website to see your PIN.`,
          );
        }

        const { data: assigned, error } = await supabaseAdmin.rpc("assign_ticket", {
          _order_id: order.id,
        });
        if (error) return reply("END Sorry, this plan is sold out right now.");
        const pin = Array.isArray(assigned) ? assigned[0]?.pin : null;
        return reply(`END Your ${pkg.name} ticket PIN is ${pin}. Keep it safe.`);
      },
    },
  },
});
