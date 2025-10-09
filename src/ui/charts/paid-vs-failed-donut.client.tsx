"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type PaidVsFailedDonutProps = {
	paid: number;
	failed: number;
	height?: number;
};

export function PaidVsFailedDonut({ paid, failed, height = 200 }: PaidVsFailedDonutProps) {
	const series = useMemo(() => [paid, failed], [paid, failed]);
	const options = useMemo(
		() => ({
			chart: { type: "donut", animations: { enabled: true } },
			labels: ["Paid", "Failed"],
			colors: ["#22c55e", "#ef4444"],
			legend: { show: true, position: "bottom" },
			dataLabels: { enabled: false },
			stroke: { width: 0 },
		}),
		[],
	);
	return (
		<ReactApexChart
			options={options as unknown as Record<string, unknown>}
			series={series as unknown as number[]}
			type="donut"
			height={height}
		/>
	);
}
