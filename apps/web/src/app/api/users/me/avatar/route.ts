import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/users/me/avatar
 * Uploads an avatar image for the current user.
 * Body: multipart/form-data with 'avatar' field
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Content-Type must be multipart/form-data' },
      { status: 400 },
    );
  }

  const formData = await req.formData();
  const avatarFile = formData.get('avatar');

  if (!avatarFile || !(avatarFile instanceof File)) {
    return NextResponse.json({ error: 'Missing avatar file' }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(avatarFile.type)) {
    return NextResponse.json({ error: 'Avatar must be PNG, JPEG, GIF, or WebP' }, { status: 400 });
  }

  // Validate file size (max 2MB)
  const maxSize = 2 * 1024 * 1024; // 2MB
  if (avatarFile.size > maxSize) {
    return NextResponse.json({ error: 'Avatar must be less than 2MB' }, { status: 400 });
  }

  // Read file content
  const bytes = await avatarFile.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');

  // Determine extension from content type
  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  const ext = extMap[avatarFile.type] ?? 'png';

  // Create a unique filename based on user ID and timestamp
  const filename = `avatar_${session.user.id}_${Date.now()}.${ext}`;

  // For now, we'll store the avatar URL as a data URL
  // In production, you'd upload to S3/Cloudinary/etc.
  const avatarUrl = `data:${avatarFile.type};base64,${base64}`;

  // Update user record
  await adminDb.user.update({
    where: { externalId: session.user.id },
    data: { avatarUrl },
  });

  return NextResponse.json({ avatarUrl, filename });
}

/**
 * DELETE /api/users/me/avatar
 * Removes the current user's avatar.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await adminDb.user.update({
    where: { externalId: session.user.id },
    data: { avatarUrl: null },
  });

  return NextResponse.json({ avatarUrl: null });
}
