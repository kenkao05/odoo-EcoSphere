import { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../lib/api.js";
import GlassCard from "../components/GlassCard.jsx";
import KPITile from "../components/KPITile.jsx";

export default function Dashboard() {
  const [scores, setScores] = useState({ environmental: 0, social: 0, governance: 0, overall: 0 });
  const [ranking, setRanking] = useState([]);
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    api.get("/dashboard/summary").then(({ data }) => {
      setScores(data.scores);
      setRanking(data.departmentRanking);
    }).catch(() => {});
    api.get("/emissions-trend").then(({ data }) => setTrend(data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPITile label="Environmental Score" score={scores.environmental} colorKey="env" linkTo="/environmental" />
        <KPITile label="Social Score" score={scores.social} colorKey="social" linkTo="/social" />
        <KPITile label="Governance Score" score={scores.governance} colorKey="gov" linkTo="/governance" />
        <KPITile label="Overall ESG Score" score={scores.overall} colorKey="overall" linkTo="/settings" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="font-semibold mb-3">Emissions Trend (12 mo)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#2E9E5B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold mb-3">Department ESG Ranking</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ranking}>
              <XAxis dataKey="department" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="score" fill="#3B82C4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>
    </div>
  );
}