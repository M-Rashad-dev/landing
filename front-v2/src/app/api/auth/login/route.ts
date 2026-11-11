import type { NextRequest } from "next/server";
import { forwardAuth } from "@/lib/auth/upstream-auth";

export async function POST(request: NextRequest) {
  return forwardAuth(request, "/auth/login");
}
