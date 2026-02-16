import { NextResponse } from 'next/server';

const API_URL = process.env.AGENTIC_BROWSER_API_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/jobs`);

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Agentic API error: ${response.status}` },
        { status: response.status }
      );
    }

    const jobs = await response.json();

    return NextResponse.json({ success: true, jobs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Failed to list jobs: ${message}` },
      { status: 500 }
    );
  }
}
