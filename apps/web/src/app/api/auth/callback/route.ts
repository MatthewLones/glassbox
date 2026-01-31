import { NextRequest, NextResponse } from 'next/server';
import { authConfig, getTokenUrl } from '@/lib/auth/config';

// Exchange authorization code for tokens
export async function POST(request: NextRequest) {
  try {
    const { code, redirectUri } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    // Exchange code for tokens with Cognito
    const tokenUrl = getTokenUrl();
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: authConfig.clientId,
      code,
      redirect_uri: redirectUri || authConfig.redirectUri,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Token exchange failed:', error);
      return NextResponse.json(
        { error: 'Failed to exchange authorization code' },
        { status: 401 }
      );
    }

    const tokens = await response.json();

    return NextResponse.json({
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
    });
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
