import { NextRequest, NextResponse } from 'next/server';

/**
 * Sync Check API
 * Used by the Hybrid Sync Engine to detect if devices are on the same network
 */

export async function GET(request: NextRequest) {
  try {
    // Return success to indicate the sync endpoint is available
    // The client can use this to detect network connectivity
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Sync endpoint available'
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('Sync check error:', error);
    return NextResponse.json(
      { error: 'Sync check failed' },
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
