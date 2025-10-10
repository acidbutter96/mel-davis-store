"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/shadcn/select";

type Props = {
	defaultStatus: string;
	defaultPeriod: string;
	defaultSort: string;
};

export function AdminFilters({ defaultStatus, defaultPeriod, defaultSort }: Props) {
	const params = useSearchParams();
	const formRef = useRef<HTMLFormElement>(null);

	const current = useMemo(() => {
		return {
			status: params.get("status") ?? defaultStatus,
			period: params.get("period") ?? defaultPeriod,
			sort: params.get("sort") ?? defaultSort,
		};
	}, [params, defaultStatus, defaultPeriod, defaultSort]);

	const submit = () => formRef.current?.requestSubmit();

	return (
		<form ref={formRef} method="get" className="flex flex-wrap gap-3 items-center">
			<input type="hidden" name="status" defaultValue={current.status} />
			<input type="hidden" name="period" defaultValue={current.period} />
			<input type="hidden" name="sort" defaultValue={current.sort} />

			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Status</span>
				<Select
					defaultValue={current.status}
					onValueChange={(v) => {
						const i = formRef.current?.elements.namedItem("status") as HTMLInputElement | null;
						if (i) i.value = v;
						submit();
					}}
				>
					<SelectTrigger className="w-[150px] sm:w-[180px]">
						<SelectValue placeholder="All" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All</SelectItem>
						<SelectItem value="paid">Paid</SelectItem>
						<SelectItem value="succeeded">Succeeded</SelectItem>
						<SelectItem value="processing">Processing</SelectItem>
						<SelectItem value="failed">Failed</SelectItem>
						<SelectItem value="refunded">Refunded</SelectItem>
						<SelectItem value="canceled">Canceled</SelectItem>
						<SelectItem value="expired">Expired</SelectItem>
						<SelectItem value="finalized">Finalized</SelectItem>
						<SelectItem value="voided">Voided</SelectItem>
						<SelectItem value="updated">Updated</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Period</span>
				<Select
					defaultValue={current.period}
					onValueChange={(v) => {
						const i = formRef.current?.elements.namedItem("period") as HTMLInputElement | null;
						if (i) i.value = v;
						submit();
					}}
				>
					<SelectTrigger className="w-[140px] sm:w-[160px]">
						<SelectValue placeholder="30 days" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="7d">Last 7 days</SelectItem>
						<SelectItem value="30d">Last 30 days</SelectItem>
						<SelectItem value="90d">Last 90 days</SelectItem>
						<SelectItem value="365d">Last 365 days</SelectItem>
						<SelectItem value="all">All time</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Sort</span>
				<Select
					defaultValue={current.sort}
					onValueChange={(v) => {
						const i = formRef.current?.elements.namedItem("sort") as HTMLInputElement | null;
						if (i) i.value = v;
						submit();
					}}
				>
					<SelectTrigger className="w-[170px] sm:w-[200px]">
						<SelectValue placeholder="Date desc" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="date-desc">Date (newest)</SelectItem>
						<SelectItem value="date-asc">Date (oldest)</SelectItem>
						<SelectItem value="amount-desc">Amount (high to low)</SelectItem>
						<SelectItem value="amount-asc">Amount (low to high)</SelectItem>
					</SelectContent>
				</Select>
			</div>
		</form>
	);
}
