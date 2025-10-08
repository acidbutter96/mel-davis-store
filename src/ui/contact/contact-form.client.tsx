"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";

interface ContactFormProps {
	className?: string;
}

export function ContactForm({ className }: ContactFormProps) {
	const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");

	const onSubmit = useCallback(
		async (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();
			if (status === "submitting") return;
			setStatus("submitting");
			const form = e.currentTarget;
			const data = Object.fromEntries(new FormData(form).entries());
			// Simular envio
			await new Promise((r) => setTimeout(r, 600));
			console.log("Contact form submitted", data);
			form.reset();
			setStatus("sent");
			setTimeout(() => setStatus("idle"), 3000);
		},
		[status],
	);

	return (
		<form onSubmit={onSubmit} className={cn("space-y-6", className)}>
			<div className="grid gap-6 sm:grid-cols-2">
				<div className="space-y-2">
					<label htmlFor="name" className="text-xs font-medium uppercase tracking-wide text-neutral-600">
						Name
					</label>
					<Input id="name" name="name" required placeholder="Your name" autoComplete="name" />
				</div>
				<div className="space-y-2">
					<label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-neutral-600">
						Email
					</label>
					<Input
						id="email"
						name="email"
						type="email"
						required
						placeholder="you@example.com"
						autoComplete="email"
					/>
				</div>
			</div>
			<div className="space-y-2">
				<label htmlFor="subject" className="text-xs font-medium uppercase tracking-wide text-neutral-600">
					Subject
				</label>
				<Input id="subject" name="subject" required placeholder="How can we help?" />
			</div>
			<div className="space-y-2">
				<label htmlFor="message" className="text-xs font-medium uppercase tracking-wide text-neutral-600">
					Message
				</label>
				<textarea
					id="message"
					name="message"
					required
					rows={6}
					className="flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
					placeholder="Write your message here..."
				/>
			</div>
			<div className="flex items-center gap-4">
				<Button type="submit" disabled={status === "submitting"} className="min-w-32">
					{status === "submitting" ? "Sending..." : status === "sent" ? "Sent!" : "Send Message"}
				</Button>
				<p aria-live="polite" className="text-xs text-neutral-500 h-4">
					{status === "sent" && "Message sent (demo)"}
				</p>
			</div>
		</form>
	);
}
