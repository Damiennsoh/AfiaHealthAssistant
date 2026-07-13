import { NextRequest, NextResponse } from 'next/server';
import { syncSessions } from '@/lib/sync-store';

/**
 * Sync Session Check API
 * Checks if a sync code exists and is valid without retrieving data
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
        { valid: false, error: 'Invalid code format' },
        { status: 200 }
      );
    }

    // Check if session exists
    const session = syncSessions.get(code);

    if (!session) {
      return NextResponse.json(
        { valid: false, error: 'Code not found' },
        { status: 200 }
      );
    }

    // Check if session has expired
    if (new Date(session.expiresAt) < new Date()) {
      syncSessions.delete(code);
      return NextResponse.json(
        { valid: false, error: 'Session expired' },
        { status: 200 }
      );
    }

    return NextResponse.json({
      valid: true,
      code: session.code,
      expiresAt: session.expiresAt,
      message: 'Valid sync code'
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Check sync code error:', error);
    return NextResponse.json(
      { valid: false, error: 'Check failed' },
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
