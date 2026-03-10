import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * POST /api/auth/mobile — Exchange Google access token for a session token.
 *
 * The mobile app uses Expo AuthSession to authenticate with Google,
 * then sends the Google access token here to get a backend session token.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken } = body;

    if (!accessToken || typeof accessToken !== "string") {
      return NextResponse.json(
        { error: "Google access token is required" },
        { status: 400 },
      );
    }

    // Verify Google access token by fetching user info
    const googleRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!googleRes.ok) {
      return NextResponse.json(
        { error: "Invalid Google access token" },
        { status: 401 },
      );
    }

    const googleUser = await googleRes.json();
    const { id: googleId, email, name, picture } = googleUser;

    if (!email) {
      return NextResponse.json(
        { error: "Email not available from Google" },
        { status: 400 },
      );
    }

    // Find or create user via Google account link
    let account = await prisma.account.findFirst({
      where: {
        provider: "google",
        providerAccountId: googleId,
      },
      include: { user: true },
    });

    let user;

    if (account) {
      user = account.user;
      // Update user info if changed
      if (user.name !== name || user.image !== picture) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { name, image: picture },
        });
      }
    } else {
      // Check if user exists by email
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        // Link Google account to existing user
        user = existingUser;
        await prisma.account.create({
          data: {
            userId: existingUser.id,
            type: "oauth",
            provider: "google",
            providerAccountId: googleId,
            access_token: accessToken,
          },
        });
      } else {
        // Create new user + account
        user = await prisma.user.create({
          data: {
            email,
            name,
            image: picture,
            accounts: {
              create: {
                type: "oauth",
                provider: "google",
                providerAccountId: googleId,
                access_token: accessToken,
              },
            },
          },
        });
      }
    }

    // Generate a session token
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires,
      },
    });

    return NextResponse.json({
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    });
  } catch (error) {
    console.error("Mobile auth error:", error);
    return NextResponse.json(
      { error: "認証処理中にエラーが発生しました" },
      { status: 500 },
    );
  }
}
