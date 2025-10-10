"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useAdminTheme } from "@/app/admin/_components/admin-theme-provider.client";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type PaidVsFailedDonutProps = {
	paid: number;
	failed: number;
	height?: number;
};

export function PaidVsFailedDonut({ paid, failed, height = 200 }: PaidVsFailedDonutProps) {
	const { theme } = useAdminTheme();
	const series = useMemo(() => [paid, failed], [paid, failed]);
	const options: ApexOptions = useMemo(
		() => ({
			theme: { mode: theme },
			chart: { type: "donut", animations: { enabled: true } },
			labels: ["Paid", "Failed"],
			colors: [theme === "dark" ? "#34d399" : "#22c55e", "#ef4444"],
			legend: { show: true, position: "bottom" },
			dataLabels: { enabled: false },
			stroke: { width: 0 },
		}),
		[theme],
	);
	return (
		<div className="overflow-x-auto">
			<div className="min-w-[320px]">
				<ReactApexChart options={options} series={series} type="donut" height={height} />
			</div>
		</div>
	);
}
