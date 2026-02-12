import { NextResponse } from 'next/server';

const AGENTIC_API_BASE = process.env.AGENTIC_API_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const response = await fetch(`${AGENTIC_API_BASE}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Health check failed: ${response.status}`,
          server: AGENTIC_API_BASE,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      server: AGENTIC_API_BASE,
      ...data,
    });

  } catch (error) {
    console.error('Error checking agentic API health:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed',
        server: AGENTIC_API_BASE,
      },
      { status: 503 }
    );
  }
}
