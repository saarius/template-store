export const prerender = false;

// Keep the text archives at /dashboard/instructions/*.txt and the index in one place.
export const GET = () => new Response(null, {
  status: 308,
  headers: { Location: '/dashboard#instructions' },
});
export const HEAD = GET;
