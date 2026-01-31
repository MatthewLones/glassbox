import { NextRequest, NextResponse } from 'next/server';
import { authConfig, getTokenUrl } from '@/lib/auth/config';

// Refresh access token using refresh token
export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      );
    }

    // Refresh tokens with Cognito
    const tokenUrl = getTokenUrl();
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: authConfig.clientId,
      refresh_token: refreshToken,
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
      console.error('Token refresh failed:', error);
      return NextResponse.json(
        { error: 'Failed to refresh token' },
        { status: 401 }
      );
    }

    const tokens = await response.json();

    return NextResponse.json({
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      // Cognito doesn't return a new refresh token on refresh
      refresh_token: tokens.refresh_token || refreshToken,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
    });
  } catch (error) {
    console.error('Auth refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
