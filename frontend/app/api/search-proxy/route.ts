import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    let response;

    switch (type) {
      case 'name':
        response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/byName/${encodeURIComponent(query)}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Authorization': ''
          }
        });
        break;

      case 'id':
        response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/package/${encodeURIComponent(query)}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Authorization': ''
          }
        });
        break;

      default:
        return NextResponse.json({ error: 'Invalid search type' }, { status: 400 });
    }

    console.log(`${type.toUpperCase()} Search Status:`, response.status);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Search proxy error:', error);
    return NextResponse.json({ error: 'Failed to process search request' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const body = await request.json();

    if (!body) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    let response;
    
    switch (type) {
      case 'regex':
        const regexQuery = body.query.includes('.*') ? body.query : `.*${body.query}.*`;
        response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/package/byRegEx`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Authorization': ''
          },
          body: JSON.stringify({ 
            RegEx: regexQuery 
          })
        });
        break;

      case 'smart':
        response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/recommend`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Authorization': ''
          },
          body: JSON.stringify({ Description: body.query })
        });
        break;

      default:
        return NextResponse.json({ error: 'Invalid search type' }, { status: 400 });
    }

    console.log(`${type.toUpperCase()} Search Status:`, response.status);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Search proxy error:', error);
    return NextResponse.json({ error: 'Failed to process search request' }, { status: 500 });
  }
}