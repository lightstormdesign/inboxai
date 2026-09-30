"use client";

import { upload } from "@vercel/blob/client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createPostAction } from "@/app/actions";
import { FormMessage, SubmitButton, inputCls } from "@/components/form";
import type { TargetInput } from "@/lib/publishing";

export type TargetOption = {
  key: string;
  group: string;
  label: string;
  target: TargetInput;
  needsMedia?: boolean;
  needsVideo?: boolean;
};

export function Composer({ options, uploadsEnabled, workspaceId }: { options: TargetOption[]; uploadsEnabled: boolean; workspaceId: string }) {
  const [state, action] = useActionState(createPostAction, undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [media, setMedia] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [tzOffset, setTzOffset] = useState(0);
  useEffect(() => setTzOffset(new Date().getTimezoneOffset()), []);
  // Clear the composer after a successful publish/schedule.
  useEffect(() => {
    if (state?.ok) {
      setSelected(new Set());
      setMedia(null);
      setWhen("now");
    }
  }, [state]);

  const groups = useMemo(() => {
    const m = new Map<string, TargetOption[]>();
    for (const o of options) m.set(o.group, [...(m.get(o.group) ?? []), o]);
    return [...m.entries()];
  }, [options]);

  const targets = options.filter((o) => selected.has(o.key)).map((o) => o.target);
  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(0);
    try {
      const blob = await upload(`posts/${workspaceId}/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        multipart: file.size > 20 * 1024 * 1024,
        onUploadProgress: (p) => setUploading(Math.round(p.percentage)),
      });
      setMedia({ url: blob.url, type: file.type.startsWith("video") ? "video" : "image" });
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(null);
    }
  };

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <FormMessage state={state} />
      <input type="hidden" name="targets" value={JSON.stringify(targets)} />
      <input type="hidden" name="mediaUrl" value={media?.url ?? ""} />
      <input type="hidden" name="mediaType" value={media?.type ?? ""} />
      <input type="hidden" name="tzOffset" value={tzOffset} />
      <input type="hidden" name="when" value={when} />

      <div>
        <p className="text-sm font-medium">Post to</p>
        <div className="mt-2 space-y-2">
          {groups.map(([group, opts]) => (
            <div key={group} className="flex flex-wrap items-center gap-2">
              <span className="w-full text-xs text-zinc-500 sm:w-48">{group}</span>
              {opts.map((o) => {
                const disabled = (o.needsVideo && media?.type !== "video") || false;
                return (
                  <button
                    type="button"
                    key={o.key}
                    disabled={disabled}
                    onClick={() => toggle(o.key)}
                    title={o.needsVideo ? "Reels need a video" : o.needsMedia ? "Needs a photo or video" : undefined}
                    className={`rounded-full border px-3 py-1 text-xs disabled:opacity-40 ${
                      selected.has(o.key) ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">Photo or video</p>
        {media ? (
          <div className="mt-2 flex items-center gap-3">
            {media.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.url} alt="" className="h-20 w-20 rounded-lg object-cover" />
            ) : (
              <video src={media.url} className="h-20 w-20 rounded-lg object-cover" muted />
            )}
            <button type="button" onClick={() => setMedia(null)} className="text-xs text-red-600">Remove</button>
          </div>
        ) : uploadsEnabled ? (
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="mt-2 block text-sm"
          />
        ) : (
          <input
            type="url"
            placeholder="Public image or video URL (https://…)"
            onBlur={(e) => e.target.value && setMedia({ url: e.target.value, type: /\.(mp4|mov)(\?|$)/i.test(e.target.value) ? "video" : "image" })}
            className={`${inputCls} mt-2`}
          />
        )}
        {uploading !== null && <p className="mt-1 text-xs text-zinc-500">Uploading… {uploading}%</p>}
        {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
        <p className="mt-1 text-xs text-zinc-500">Instagram needs a photo or video. Stories work best at 9:16.</p>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Caption</span>
        <textarea name="text" rows={5} maxLength={2200} className={`${inputCls} mt-1.5`} />
      </label>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={when === "now"} onChange={() => setWhen("now")} /> Post now
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={when === "later"} onChange={() => setWhen("later")} /> Schedule
        </label>
        {when === "later" && <input name="dueAt" type="datetime-local" className={`${inputCls} w-auto`} />}
      </div>

      <SubmitButton pendingText={when === "now" ? "Publishing…" : "Scheduling…"}>
        {when === "now" ? "Publish" : "Schedule"}
      </SubmitButton>
    </form>
  );
}
