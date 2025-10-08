"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface FaqItem {
	q: string;
	a: string;
}

interface FaqAccordionProps {
	items: FaqItem[];
	allowMultiple?: boolean;
	className?: string;
	defaultOpenIndexes?: number[];
}

export function FaqAccordion({
	items,
	allowMultiple = false,
	className,
	defaultOpenIndexes = [0],
}: FaqAccordionProps) {
	const [open, setOpen] = useState<Set<number>>(new Set(defaultOpenIndexes));

	const toggle = (idx: number) => {
		setOpen((prev) => {
			const next = new Set(prev);
			const isOpen = next.has(idx);
			if (allowMultiple) {
				if (isOpen) next.delete(idx);
				else next.add(idx);
			} else {
				next.clear();
				if (!isOpen) next.add(idx);
			}
			return next;
		});
	};

	return (
		<ul
			className={cn("divide-y divide-border overflow-hidden rounded-xl border bg-card shadow-sm", className)}
		>
			{items.map((item, i) => {
				const expanded = open.has(i);
				return (
					<li key={item.q} className="group">
						<button
							type="button"
							aria-expanded={expanded}
							aria-controls={`faq-panel-${i}`}
							onClick={() => toggle(i)}
							className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/40 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
						>
							<span className="text-sm font-medium leading-snug">{item.q}</span>
							<ChevronDown
								className={cn(
									"h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
									expanded && "rotate-180",
								)}
								aria-hidden
							/>
						</button>
						<div
							id={`faq-panel-${i}`}
							role="region"
							aria-labelledby={`faq-header-${i}`}
							className={cn(
								"grid transition-all duration-200 ease-out",
								expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
							)}
						>
							<div className="overflow-hidden">
								<div className="px-5 pb-5 pt-0 text-sm leading-relaxed text-muted-foreground">{item.a}</div>
							</div>
						</div>
					</li>
				);
			})}
		</ul>
	);
}
