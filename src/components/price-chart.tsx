"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

// Store colors — cycle through these for multiple stores
const STORE_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#ea580c", // orange
  "#7c3aed", // purple
  "#0891b2", // cyan
  "#d97706", // amber
  "#db2777", // pink
];

interface PriceRecord {
  id: string;
  price: number;
  recordedAt: string;
  store: { id: string; name: string };
}

interface Series {
  storeId: string;
  storeName: string;
  records: PriceRecord[];
}

interface PriceChartProps {
  series: Series[];
  stats: {
    bottomPrice: number;
    averagePrice: number;
  } | null;
}

export function PriceChart({ series, stats }: PriceChartProps) {
  if (series.length === 0) return null;

  // Build unified data points: { date, store1: price, store2: price, ... }
  const dateMap = new Map<
    string,
    Record<string, number | string>
  >();

  for (const s of series) {
    for (const r of s.records) {
      const dateKey = new Date(r.recordedAt).toLocaleDateString("ja-JP", {
        month: "short",
        day: "numeric",
      });
      const fullDate = new Date(r.recordedAt).toLocaleDateString("ja-JP");
      if (!dateMap.has(r.recordedAt)) {
        dateMap.set(r.recordedAt, { date: dateKey, fullDate, sortKey: r.recordedAt });
      }
      const entry = dateMap.get(r.recordedAt)!;
      // Use storeName as key; if multiple records same day/store, keep latest
      entry[s.storeName] = r.price;
    }
  }

  const data = Array.from(dateMap.values()).sort(
    (a, b) => String(a.sortKey).localeCompare(String(b.sortKey)),
  );

  const storeNames = series.map((s) => s.storeName);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `¥${v}`}
          width={55}
        />
        <Tooltip
          formatter={(value: string | number | (string | number)[]) => [
            `¥${Number(value).toLocaleString()}`,
          ]}
          labelFormatter={(_label: string | number) => {
            // Find the full date from the first data point
            const match = data.find((d) => d.date === _label);
            return match?.fullDate ? String(match.fullDate) : String(_label);
          }}
        />
        {storeNames.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 12 }} />
        )}
        {stats && (
          <>
            <ReferenceLine
              y={stats.bottomPrice}
              stroke="#16a34a"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={`底値 ¥${stats.bottomPrice.toLocaleString()}`}
            />
            <ReferenceLine
              y={stats.averagePrice}
              stroke="#9ca3af"
              strokeDasharray="3 3"
              strokeWidth={1}
              label={`平均 ¥${stats.averagePrice.toLocaleString()}`}
            />
          </>
        )}
        {storeNames.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={STORE_COLORS[i % STORE_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
