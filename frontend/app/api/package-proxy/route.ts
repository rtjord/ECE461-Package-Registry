import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const packageData = await request.json();

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/package`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': ''
      },
      body: JSON.stringify(packageData)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('API Error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in package proxy:', error);
    return NextResponse.json(
      { error: 'Failed to process package upload' }, 
      { status: 500 }
    );
  }
} 