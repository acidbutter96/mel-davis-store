"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useAdminTheme } from "@/app/admin/_components/admin-theme-provider.client";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type XYPoint = { x: number; y: number };

type RevenueZoomBrushProps = {
	points: XYPoint[];
	currency: string;
	mainHeight?: number;
	brushHeight?: number;
};

export function RevenueZoomBrush({
	points,
	currency,
	mainHeight = 260,
	brushHeight = 100,
}: RevenueZoomBrushProps) {
	const { theme } = useAdminTheme();
	const series = useMemo(() => [{ name: "Revenue", data: points }], [points]);

	const commonTooltipY = (val: number) => {
		try {
			return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(val / 100);
		} catch {
			return `${(val / 100).toFixed(2)} ${currency}`;
		}
	};

	const mainOptions: ApexOptions = useMemo(
		() => ({
			chart: {
				id: "rev-main",
				type: "area",
				toolbar: { show: true, tools: { zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
				animations: { enabled: true },
			},
			theme: { mode: theme === "dark" ? "dark" : "light" },
			stroke: { curve: "smooth", width: 2 },
			fill: { type: "gradient", gradient: { shadeIntensity: 0.3, opacityFrom: 0.4, opacityTo: 0.1 } },
			colors: theme === "dark" ? ["#34d399"] : ["#22c55e"],
			xaxis: { type: "datetime" },
			dataLabels: { enabled: false },
			tooltip: { y: { formatter: commonTooltipY } },
		}),
		[currency, theme],
	);

	const brushOptions: ApexOptions = useMemo(
		() => ({
			chart: {
				id: "rev-brush",
				type: "area",
				brush: { enabled: true, target: "rev-main" },
				selection: { enabled: true },
				animations: { enabled: true },
			},
			theme: { mode: theme === "dark" ? "dark" : "light" },
			stroke: { curve: "smooth", width: 1 },
			fill: { type: "solid", opacity: 0.3 },
			colors: theme === "dark" ? ["#34d399"] : ["#22c55e"],
			xaxis: {
				type: "datetime",
				labels: { show: false },
				axisBorder: { show: false },
				axisTicks: { show: false },
			},
			yaxis: { labels: { show: false } },
			dataLabels: { enabled: false },
			tooltip: { enabled: false },
			grid: { show: false },
			legend: { show: false },
		}),
		[theme],
	);

	return (
		<div className="space-y-2">
			<ReactApexChart options={mainOptions} series={series} type="area" height={mainHeight} />
			<ReactApexChart options={brushOptions} series={series} type="area" height={brushHeight} />
		</div>
	);
}
