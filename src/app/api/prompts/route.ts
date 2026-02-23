import { NextRequest, NextResponse } from 'next/server';
import {
  fetchSavedPrompts,
  createSavedPrompt,
  updateSavedPrompt,
  deleteSavedPrompt,
  incrementPromptUseCount,
} from '@/lib/supabase-operations';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let prompts;
    if (category) {
      const { fetchSavedPromptsByCategory } = await import('@/lib/supabase-operations');
      prompts = await fetchSavedPromptsByCategory(category);
    } else {
      prompts = await fetchSavedPrompts();
    }

    return NextResponse.json({ prompts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch prompts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, category, tags, is_favorite } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const prompt = await createSavedPrompt({
      title,
      content,
      category: category || 'general',
      tags: tags || [],
      is_favorite: is_favorite || false,
    });

    return NextResponse.json({ prompt });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create prompt';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    if (action === 'increment_use') {
      await incrementPromptUseCount(id);
      return NextResponse.json({ success: true });
    }

    const prompt = await updateSavedPrompt(id, updates);
    return NextResponse.json({ prompt });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update prompt';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await deleteSavedPrompt(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete prompt';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
