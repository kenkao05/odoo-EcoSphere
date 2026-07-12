import { useNavigate } from "react-router-dom";
import GlassCard from "./GlassCard.jsx";

const COLOR_MAP = {
  env: "border-l-esg-env text-esg-env",
  social: "border-l-esg-social text-esg-social",
  gov: "border-l-esg-gov text-esg-gov",
  overall: "border-l-esg-overall text-esg-overall",
};

export default function KPITile({ label, score, colorKey, linkTo }) {
  const navigate = useNavigate();
  return (
    <GlassCard
      as="button"
      onClick={() => linkTo && navigate(linkTo)}
      className={`border-l-4 text-left w-full hover:scale-[1.01] transition-transform ${COLOR_MAP[colorKey]}`}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-3xl font-semibold mt-1">
        {score} <span className="text-base text-slate-400 font-normal">/ 100</span>
      </p>
    </GlassCard>
  );
}
