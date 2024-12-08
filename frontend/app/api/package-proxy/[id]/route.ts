import { NextResponse } from 'next/server';

// GET handler for downloading package and getting package info
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    // Check if this is a rate, cost, or download request
    const { pathname } = new URL(request.url);
    
    let endpoint = `/package/${id}`;
    if (pathname.endsWith('/rate')) {
      endpoint = `/package/${id}/rate`;
    } else if (pathname.endsWith('/cost')) {
      endpoint = `/package/${id}/cost`;
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': ''
      }
    });

    console.log(`${endpoint} Status:`, response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || response.statusText);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Package proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
}

// POST handler for updating package
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json();

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/package/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': ''
      },
      body: JSON.stringify(body)
    });

    console.log('Update Package Status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || response.statusText);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Package update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update package' },
      { status: 500 }
    );
  }
} 