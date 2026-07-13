import { NextRequest, NextResponse } from 'next/server';
import { syncSessions } from '@/lib/sync-store';

/**
 * Sync Session Join API
 * Retrieves data from an existing cloud sync session
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Missing required parameter: code' },
        { status: 400 }
      );
    }

    // Validate code format
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'Invalid code format. Must be 6 digits.' },
        { status: 400 }
      );
    }

    // Check if session exists
    const session = syncSessions.get(code);

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired sync code' },
        { status: 404 }
      );
    }

    // Check if session has expired
    if (new Date(session.expiresAt) < new Date()) {
      syncSessions.delete(code); // Clean up expired session
      return NextResponse.json(
        { error: 'Sync session has expired' },
        { status: 410 }
      );
    }

    console.log(`Sync session retrieved: ${code}`);

    return NextResponse.json({
      success: true,
      code: session.code,
      data: session.data,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      deviceId: session.deviceId
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Join sync session error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve sync session' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
