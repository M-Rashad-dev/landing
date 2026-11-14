"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/logout";
import { ar } from "@/messages/ar";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      loading={busy}
      onClick={() => {
        setBusy(true);
        void logout();
      }}
    >
      <LogOut />
      {ar.nav.logout}
    </Button>
  );
}
