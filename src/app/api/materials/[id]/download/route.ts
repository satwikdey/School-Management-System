import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Query study_materials through the user's RLS-bound client!
  // Unauthorized students/parents from other classes receive no rows.
  const { data: material, error } = await supabase
    .from('study_materials')
    .select('id, title, file_name, file_path, mime_type')
    .eq('id', params.id)
    .single();

  if (error || !material) {
    return NextResponse.json(
      { error: 'Study material not found or you are not authorized to access it.' },
      { status: 403 }
    );
  }

  const serviceClient = createServiceRoleClient();
  const url = new URL(request.url);

  // If ?mode=signed is requested, return the expiring signed URL JSON (valid for 5 minutes)
  if (url.searchParams.get('mode') === 'signed') {
    const { data: signed, error: signErr } = await serviceClient.storage
      .from('study-materials')
      .createSignedUrl(material.file_path, 300);

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json(
        { error: signErr?.message || 'Could not generate expiring download link.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      materialId: material.id,
      fileName: material.file_name,
      signedUrl: signed.signedUrl,
      expiresInSeconds: 300,
    });
  }

  // Otherwise stream the authorized file download directly
  const { data: fileBlob, error: dlError } = await serviceClient.storage
    .from('study-materials')
    .download(material.file_path);

  if (dlError || !fileBlob) {
    return NextResponse.json(
      { error: dlError?.message || 'File download failed.' },
      { status: 500 }
    );
  }

  const arrayBuffer = await fileBlob.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': material.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(material.file_name)}"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
