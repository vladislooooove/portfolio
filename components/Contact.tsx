"use client";

import { useState } from "react";
import {
  CheckCircle,
  GithubLogo,
  LinkedinLogo,
  SpinnerGap,
  StackOverflowLogo,
  Briefcase,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import Button from "./Button";
import Section from "./Section";
import SplitLines from "./SplitLines";
import { CONTACT, LINKS, PERSON } from "@/lib/content";

type Status = "idle" | "sending" | "sent" | "failed";
type Errors = { name?: string; email?: string; brief?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const field =
  "mt-2 w-full border border-line-control bg-surf px-4 py-3 text-base text-text transition-colors duration-200 focus:border-glow focus:outline-none";

const SOCIALS = [
  { href: LINKS.linkedin, label: "LinkedIn profile", Icon: LinkedinLogo },
  { href: LINKS.github, label: "GitHub profile", Icon: GithubLogo },
  { href: LINKS.stackoverflow, label: "Stack Overflow profile", Icon: StackOverflowLogo },
  { href: LINKS.upwork, label: "Upwork profile", Icon: Briefcase },
];

export default function Contact() {
  const [values, setValues] = useState({ name: "", email: "", brief: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState("");

  function set(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!values.name.trim()) next.name = "Tell me who you are.";
    if (!EMAIL.test(values.email.trim())) next.email = "That address looks off.";
    if (values.brief.trim().length < 12) next.brief = "A sentence or two is enough.";
    return next;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    setStatus("sending");
    setFailure("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setFailure(data.error ?? "Something broke on the way out. Try again.");
        setStatus("failed");
        return;
      }
      setStatus("sent");
    } catch {
      setFailure("No connection to the server. Try again in a moment.");
      setStatus("failed");
    }
  }

  return (
    <Section
      id="contact"
      tone="void"
      texture={<div className="halo -bottom-32 right-[10%] h-[420px] w-[420px]" />}
    >
      <div className="grid grid-cols-1 gap-16 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-5">
          <h2 className="font-display text-[clamp(2rem,4.4vw,3.75rem)] leading-[0.95] font-bold tracking-[-0.02em]">
            <SplitLines lines={CONTACT.lines} inView />
          </h2>
          <p className="mt-8 max-w-[46ch] text-base leading-relaxed text-muted md:text-lg">
            {CONTACT.body}
          </p>

          <a
            href={`mailto:${PERSON.email}`}
            className="link-wipe mt-10 font-mono text-base text-text hover:text-glow"
          >
            {PERSON.email}
          </a>

          <div className="mt-8 flex items-center gap-3">
            {SOCIALS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={label}
                className="icon-btn"
              >
                <Icon size={20} weight="regular" />
              </a>
            ))}
          </div>
        </div>

        <div className="md:col-span-6 md:col-start-7">
          {status === "sent" ? (
            <div className="panel-deep flex flex-col items-start p-8 md:p-10">
              <CheckCircle size={28} weight="regular" className="text-glow" />
              <p className="font-display mt-5 text-2xl font-bold tracking-tight">
                Message received.
              </p>
              <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-muted">
                I read everything myself and reply within 2 working days, usually
                with a question or two.
              </p>
              <div className="mt-7">
                <Button
                  type="button"
                  label="Write another"
                  variant="ghost"
                  size="sm"
                  magnetic={0.18}
                  onClick={() => {
                    setValues({ name: "", email: "", brief: "" });
                    setStatus("idle");
                  }}
                />
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-text">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={values.name}
                  onChange={(e) => set("name", e.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  className={field}
                />
                {errors.name && <p className="mt-2 text-sm text-glow">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  className={field}
                />
                {errors.email ? (
                  <p className="mt-2 text-sm text-glow">{errors.email}</p>
                ) : (
                  <p className="mt-2 text-sm text-muted">Used for the reply, nothing else.</p>
                )}
              </div>

              <div>
                <label htmlFor="brief" className="block text-sm font-medium text-text">
                  What you are building
                </label>
                <textarea
                  id="brief"
                  name="brief"
                  rows={5}
                  value={values.brief}
                  onChange={(e) => set("brief", e.target.value)}
                  aria-invalid={Boolean(errors.brief)}
                  className={`${field} resize-y`}
                />
                {errors.brief ? (
                  <p className="mt-2 text-sm text-glow">{errors.brief}</p>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    The team, the stack, and what is hard about it right now.
                  </p>
                )}
              </div>

              {status === "failed" && (
                <div
                  role="alert"
                  className="flex items-start gap-3 border border-glow/50 bg-accent/10 px-4 py-3"
                >
                  <WarningCircle size={18} weight="regular" className="mt-0.5 shrink-0 text-glow" />
                  <p className="text-sm text-text">{failure}</p>
                </div>
              )}

              <div className="self-start">
                <Button
                  type="submit"
                  disabled={status === "sending"}
                  label={status === "sending" ? "Sending" : CONTACT.submit}
                  magnetic={0.22}
                  icon={
                    status === "sending" ? (
                      <SpinnerGap size={16} weight="regular" className="animate-spin" />
                    ) : undefined
                  }
                />
              </div>
            </form>
          )}
        </div>
      </div>
    </Section>
  );
}
