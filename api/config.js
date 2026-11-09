// GET /api/config
// Public tracking IDs, read from env vars so they are not hardcoded in the HTML.
// The page only calls this after the visitor accepts the cookie banner.
export function GET() {
  return new Response(
    JSON.stringify({
      ga4Id: process.env.GA4_MEASUREMENT_ID || '',
      metaPixelId: process.env.META_PIXEL_ID || '',
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    },
  );
}
