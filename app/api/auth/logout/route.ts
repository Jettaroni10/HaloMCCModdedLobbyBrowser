import { NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/auth";
import { absoluteUrl } from "@/lib/url";

function buildLogoutResponse(request: Request) {
  const response = NextResponse.redirect(absoluteUrl(request, "/"));
  response.cookies.set(getSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
  });
  return response;
}

export async function POST(request: Request) {
  return buildLogoutResponse(request);
}

export async function GET(request: Request) {
  return buildLogoutResponse(request);
}

