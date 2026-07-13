import { NextRequest, NextResponse } from 'next/server';

interface LockoutSyncData {
  userId: string;
  deviceId: string;
  action: 'clear' | 'sync';
  failedAttempts?: number;
  lockoutUntil?: number | undefined;
  lastAttemptAt?: number;
  timestamp: number;
}

// In-memory storage for demo (replace with real database in production)
const lockoutStore = new Map<string, LockoutSyncData>();

export async function POST(request: NextRequest) {
  try {
    const data: LockoutSyncData = await request.json();
    
    // Validate required fields
    if (!data.userId || !data.deviceId || !data.action) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, deviceId, action' },
        { status: 400 }
      );
    }

    const key = `${data.userId}_${data.deviceId}`;
    
    if (data.action === 'clear') {
      // Clear lockout state
      lockoutStore.delete(key);
      console.log(`[API] Cleared lockout for user ${data.userId} on device ${data.deviceId}`);
      
      return NextResponse.json({
        success: true,
        message: 'Lockout state cleared',
        timestamp: data.timestamp
      });
      
    } else if (data.action === 'sync') {
      // Sync/update lockout state
      const existingData = lockoutStore.get(key);
      
      const lockoutData: LockoutSyncData = {
        userId: data.userId,
        deviceId: data.deviceId,
        action: 'sync',
        failedAttempts: data.failedAttempts || 0,
        lockoutUntil: data.lockoutUntil ?? undefined,
        lastAttemptAt: data.lastAttemptAt || undefined,
        timestamp: data.timestamp
      };
      
      // Only update if newer or doesn't exist
      if (!existingData || data.timestamp > (existingData.timestamp || 0)) {
        lockoutStore.set(key, lockoutData);
        console.log(`[API] Synced lockout for user ${data.userId}: ${data.failedAttempts} attempts`);
      }
      
      return NextResponse.json({
        success: true,
        message: 'Lockout state synced',
        data: lockoutData
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('[API] Lockout sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync lockout state' },
      { status: 500 }
    );
  }
}

// GET endpoint to check lockout status across devices
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const deviceId = searchParams.get('deviceId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }
    
    // Get all lockout records for this user across devices
    const userLockouts: LockoutSyncData[] = [];
    
    for (const [key, data] of lockoutStore.entries()) {
      if (data.userId === userId) {
        userLockouts.push(data);
      }
    }
    
    // If specific device requested, filter by device
    if (deviceId) {
      const deviceLockout = userLockouts.find(lockout => lockout.deviceId === deviceId);
      return NextResponse.json({
        success: true,
        lockout: deviceLockout || null,
        allDevices: userLockouts
      });
    }
    
    return NextResponse.json({
      success: true,
      userLockouts,
      totalDevices: userLockouts.length
    });
    
  } catch (error) {
    console.error('[API] Lockout status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check lockout status' },
      { status: 500 }
    );
  }
}
