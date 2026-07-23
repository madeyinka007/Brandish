"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getPost, type PostRecord } from "@/lib/posts";
import PostEditor from "@/components/admin/PostEditor";

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [post, setPost] = useState<PostRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPost(id)
      .then((p) => {
        if (!alive) return;
        if (!p) setError("Post not found.");
        else setPost(p);
      })
      .catch((e) => alive && setError((e as Error).message || "Failed to load post"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) return <div className="flex h-64 items-center justify-center text-sm text-slate-400">Loading post…</div>;
  if (error || !post) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">{error ?? "Post not found."}</p>
        <Link href="/admin/posts" className="mt-4 inline-block text-sm font-medium text-brand hover:text-brand-dark">
          ← Back to posts
        </Link>
      </div>
    );
  }
  return <PostEditor mode="edit" initial={post} />;
}
