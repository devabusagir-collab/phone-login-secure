import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import logo from "@/assets/tadikko-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { credentialsFor, isValidPin, normalizePhone } from "@/lib/phone";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Ta Dikko Riders Hotspot" },
      { name: "description", content: "Sign in with your phone number and 4-digit PIN to buy hotspot tickets." },
      { property: "og:title", content: "Sign in — Ta Dikko Riders Hotspot" },
      { property: "og:description", content: "Phone number and 4-digit PIN sign in." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  function validate() {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      toast.error("Enter a valid phone number, e.g. 08031234567");
      return null;
    }
    if (!isValidPin(pin)) {
      toast.error("Your PIN must be exactly 4 digits");
      return null;
    }
    return normalized;
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const normalized = validate();
    if (!normalized) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(credentialsFor(normalized, pin));
    setBusy(false);
    if (error) {
      toast.error("Wrong phone number or PIN");
      return;
    }
    navigate({ to: "/dashboard" });
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    const normalized = validate();
    if (!normalized) return;
    if (pin !== confirmPin) {
      toast.error("The two PINs do not match");
      return;
    }
    setBusy(true);
    const creds = credentialsFor(normalized, pin);
    const { error } = await supabase.auth.signUp({
      ...creds,
      options: {
        emailRedirectTo: window.location.origin,
        data: { phone: normalized, full_name: name },
      },
    });
    if (error) {
      setBusy(false);
      toast.error(
        error.message.toLowerCase().includes("already")
          ? "This phone number already has an account. Please sign in."
          : "Could not create your account",
      );
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword(creds);
    setBusy(false);
    if (signInError) {
      toast.success("Account created. Please sign in.");
      return;
    }
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/40 px-4 py-10">
      <img src={logo.url} alt="Ta Dikko Riders" className="mb-6 w-64 max-w-full" />
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="register">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    inputMode="tel"
                    placeholder="08031234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={20}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pin">4-digit PIN</Label>
                  <Input
                    id="pin"
                    inputMode="numeric"
                    type="password"
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Please wait…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={register} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rphone">Phone number</Label>
                  <Input
                    id="rphone"
                    inputMode="tel"
                    placeholder="08031234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={20}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="rpin">Choose a PIN</Label>
                    <Input
                      id="rpin"
                      inputMode="numeric"
                      type="password"
                      placeholder="••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpin">Repeat PIN</Label>
                    <Input
                      id="cpin"
                      inputMode="numeric"
                      type="password"
                      placeholder="••••"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Please wait…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Keep your PIN private. Anyone with your phone number and PIN can open your account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
