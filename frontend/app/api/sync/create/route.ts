import { NextRequest, NextResponse } from 'next/server';
import { SyncSession, syncSessions } from '@/lib/sync-store';

/**
 * Sync Session Create API
 * Creates a new cloud sync session with a unique code
 * In production, this would store data in Redis/Firestore
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, data, expiresAt, deviceId } = body;

    if (!code || !data || !expiresAt) {
      return NextResponse.json(
        { error: 'Missing required fields: code, data, expiresAt' },
        { status: 400 }
      );
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'Invalid code format. Must be 6 digits.' },
        { status: 400 }
      );
    }

    // Check if code already exists
    if (syncSessions.has(code)) {
      return NextResponse.json(
        { error: 'Code already in use. Please generate a new code.' },
        { status: 409 }
      );
    }

    // Create session
    const session: SyncSession = {
      code,
      data,
      expiresAt,
      createdAt: new Date().toISOString(),
      deviceId: deviceId || 'unknown'
    };

    // Store session (in production, use Redis with TTL)
    syncSessions.set(code, session);

    // Auto-expire after 30 minutes (in production, use Redis TTL)
    setTimeout(() => {
      syncSessions.delete(code);
    }, 30 * 60 * 1000);

    console.log(`Sync session created: ${code}, expires: ${expiresAt}`);

    return NextResponse.json({
      success: true,
      code,
      expiresAt,
      message: 'Sync session created successfully'
    }, {
      status: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Create sync session error:', error);
    return NextResponse.json(
      { error: 'Failed to create sync session' },
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
