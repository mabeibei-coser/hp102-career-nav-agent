import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { createUser, getUser, touchUser } from "./db/repositories/users";

export interface SessionData {
  userId?: string;
}

const COOKIE_NAME = "hp102_session";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

export function getSessionOptions(): SessionOptions {
  return {
    password: getSessionSecret(),
    cookieName: COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: process.env.NEXT_PUBLIC_BASE_PATH || "/",
      maxAge: 60 * 60 * 24 * 30,
    },
  };
}

export async function getOrCreateUser(): Promise<string> {
  const session = await getIronSession<SessionData>(
    await cookies(),
    getSessionOptions(),
  );

  if (session.userId) {
    const existing = getUser(session.userId);
    if (existing) {
      touchUser(session.userId);
      return session.userId;
    }
  }

  const userId = createUser();
  session.userId = userId;
  await session.save();
  return userId;
}
