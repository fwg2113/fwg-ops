// app/api/estimator/gallery/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicle = searchParams.get('vehicle');

    if (!vehicle) {
      return NextResponse.json(
        { ok: false, error: 'vehicle parameter required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch ALL active photos for this vehicle category
    // Client-side JS will filter by project_type for instant switching
    const { data, error } = await supabase
      .from('gallery_photos')
      .select('id, vehicle_category, project_type, image_url, thumbnail_url, caption, sort_order')
      .eq('vehicle_category', vehicle)
      .eq('active', true)
      .order('project_type')
      .order('sort_order');

    if (error) {
      console.error('Gallery fetch error:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    // Add CORS headers for Shopify cross-origin requests
    const response = NextResponse.json({ ok: true, photos: data || [] });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET');
    return response;

  } catch (err: any) {
    console.error('Gallery API error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
