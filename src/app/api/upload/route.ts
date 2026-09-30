import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { authOrNull } from "@/lib/auth";

/**
 * Issues short-lived tokens so the browser can upload post media straight to
 * Vercel Blob (bypassing the 4.5 MB function body limit). Instagram/Facebook
 * fetch the media from the resulting public URL when publishing.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Only token *generation* comes from the browser; the completion callback
        // comes from Vercel and is signature-verified by handleUpload itself.
        const ctx = await authOrNull();
        if (!ctx) throw new Error("Not signed in");
        if (!pathname.startsWith(`posts/${ctx.workspace.id}/`)) throw new Error("Invalid upload path");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"],
          maximumSizeInBytes: 300 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
