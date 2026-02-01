import { NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/auth";
import { absoluteUrl } from "@/lib/url";

export async function POST(request: Request) {
  const response = NextResponse.redirect(absoluteUrl(request, "/"));
  response.cookies.set(getSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
  });
  return response;
}

