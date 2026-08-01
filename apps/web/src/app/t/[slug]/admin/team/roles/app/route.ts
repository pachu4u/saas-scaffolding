import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const host = req.headers.get('host') ?? 'localhost';
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  return NextResponse.redirect(`${proto}://${host}/t/${slug}/admin/team/roles`, 308);
}
