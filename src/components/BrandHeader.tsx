import { Link, useNavigate } from "@tanstack/react-router";
import logo from "@/assets/tadikko-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/lib/session";

export function BrandHeader() {
  const { session } = useSession();
  const isAdmin = useIsAdmin(session?.user.id);
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo.url} alt="Ta Dikko Riders Hotspot & Entertainment" className="h-10 w-auto" />
        </Link>
        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          {session ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard">Buy data</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/tickets">My tickets</Link>
              </Button>
              {isAdmin && (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin">Admin</Link>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
