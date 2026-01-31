import { NextRequest, NextResponse } from 'next/server';

// Get the backend API URL from environment
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Exchange access token for a WebSocket token
// This calls the backend's /api/v1/auth/ws-token endpoint
export async function POST(request: NextRequest) {
  try {
    // Get the access token from the Authorization header
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.substring(7);

    // Forward the request to the backend API
    const response = await fetch(`${API_URL}/api/v1/auth/ws-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WS token exchange failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to obtain WebSocket token' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      token: data.token,
      expiresAt: data.expires_at,
    });
  } catch (error) {
    console.error('WS token error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
