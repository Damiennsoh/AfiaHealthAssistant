import { NextRequest, NextResponse } from 'next/server';
import { syncSessions } from '@/lib/sync-store';

/**
 * Sync Session Cancel API
 * Cancels and removes a sync session
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Missing required field: code' },
        { status: 400 }
      );
    }

    // Check if session exists
    const existed = syncSessions.has(code);

    if (existed) {
      syncSessions.delete(code);
      console.log(`Sync session cancelled: ${code}`);
    }

    return NextResponse.json({
      success: true,
      code,
      existed,
      message: existed ? 'Sync session cancelled' : 'Session not found'
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Cancel sync session error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel sync session' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
