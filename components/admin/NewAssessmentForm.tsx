"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { createAssessment } from "@/app/(admin)/admin/actions";
import type { CreateResult } from "@/app/(admin)/admin/actions";

/**
 * The three-field create form and, once it succeeds, the invite link.
 *
 * The link is rendered as selectable text *and* offered behind a Copy button,
 * with an automatic copy attempted on success. All three deliberately: the
 * automatic copy happens after an await on the server action, which puts it
 * outside the original user gesture, and Safari will sometimes refuse it. The
 * visible URL is the path that cannot fail.
 */

const FIELD =
  "w-full rounded-md border border-divider bg-bg px-3.5 py-2.5 text-[15px] text-ink outline-none placeholder:text-steel-500 focus:border-aqua-700";

const LABEL =
  "mb-1.5 block text-[11px] font-semibold tracking-[.08em] text-steel-700 uppercase";

export function NewAssessmentForm() {
  const [result, action, pending] = useActionState<CreateResult, FormData>(
    createAssessment,
    { status: "idle" },
  );
  const [copied, setCopied] = useState(false);

  const link = result.status === "created" ? result.link : null;

  useEffect(() => {
    if (!link) return;
    void navigator.clipboard?.writeText(link).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }, [link]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (result.status === "created") {
    return (
      <div className="max-w-2xl">
        <div className="rounded-lg border border-aqua bg-aqua-200/50 px-5 py-4">
          <div className="text-[11px] font-semibold tracking-[.1em] text-aqua-700 uppercase">
            Assessment created
          </div>
          <p className="mt-1.5 text-[15px] text-ink">
            Send this link to {result.homeownerFirstName}. Opening it starts
            their own assessment, beginning with confirming the property.
          </p>
        </div>

        <div className="mt-5">
          <span className={LABEL}>Invite link</span>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 overflow-x-auto rounded-md border border-divider bg-steel-200 px-3.5 py-2.5 font-mono text-[13px] break-all text-ink select-all">
              {link}
            </code>
            <button
              type="button"
              onClick={copy}
              className="btn btn-secondary shrink-0 px-4"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-[13px] text-steel-600">
            {copied
              ? "Copied to your clipboard."
              : "Select the link above to copy it."}
          </p>
        </div>

        <div className="mt-7 flex gap-3">
          <Link href="/admin" className="btn btn-primary px-5">
            Back to assessments
          </Link>
          <Link href="/admin/new" className="btn btn-secondary px-5">
            Create another
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="max-w-lg">
      <div className="mb-5">
        <label className={LABEL} htmlFor="name">
          Homeowner first name
        </label>
        <input id="name" name="name" required className={FIELD} placeholder="Alex" />
      </div>

      <div className="mb-5">
        <label className={LABEL} htmlFor="address">
          Property address
        </label>
        <input
          id="address"
          name="address"
          required
          className={FIELD}
          placeholder="412 Marlow Street, Tampa"
        />
      </div>

      <div className="mb-6">
        <label className={LABEL} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className={FIELD}
          placeholder="alex@example.com"
        />
        {/* Stored on the assessment. Nothing sends to it yet — the link is
            delivered by copying it. */}
        <p className="mt-1.5 text-[13px] text-steel-600">
          Recorded with the assessment. No email is sent — copy the link on the
          next screen.
        </p>
      </div>

      {result.status === "error" && (
        <p className="mb-4 rounded-md bg-red-50 px-3.5 py-2.5 text-[14px] text-red-700">
          {result.message}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary px-5 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create assessment"}
        </button>
        <Link href="/admin" className="btn btn-secondary px-5">
          Cancel
        </Link>
      </div>
    </form>
  );
}
