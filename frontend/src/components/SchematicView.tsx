import type { Artifact } from "../types";

export function SchematicView({ artifact }: { artifact: Artifact | undefined }) {
  const components = ((artifact?.extra?.components as { reference: string; value: string; footprint: string }[]) || []);
  const nets = (artifact?.extra?.nets as string[]) || [];
  return (
    <div className="schematic">
      <div style={{ marginBottom: 12, color: "#8fba78" }}>{artifact?.identifier} · {artifact?.title}</div>
      <svg viewBox="0 0 720 280" width="100%" height="280">
        <rect x="40" y="70" width="150" height="90" fill="none" stroke="#c6f3b0" rx="4" />
        <text x="70" y="122" fill="#c6f3b0">U1 MCU</text>
        <rect x="280" y="40" width="120" height="50" fill="none" stroke="#c6f3b0" />
        <text x="300" y="70" fill="#c6f3b0">U2 FLASH</text>
        <rect x="280" y="140" width="120" height="50" fill="none" stroke="#c6f3b0" />
        <text x="298" y="170" fill="#c6f3b0">J1 US</text>
        <rect x="500" y="70" width="140" height="90" fill="none" stroke="#c6f3b0" />
        <text x="522" y="122" fill="#c6f3b0">U3 TMC2209</text>
        <line x1="190" y1="100" x2="280" y2="65" stroke="#c6f3b0" />
        <line x1="190" y1="130" x2="280" y2="165" stroke="#c6f3b0" />
        <line x1="190" y1="115" x2="500" y2="115" stroke="#c6f3b0" />
        <circle cx="40" cy="40" r="4" fill="#c45e2b" />
        <text x="52" y="44" fill="#e8c547">VBAT</text>
      </svg>
      <div>
        {components.map((c) => (
          <div key={c.reference}>
            {c.reference.padEnd(4, " ")} {c.value} · {c.footprint}
          </div>
        ))}
        <div style={{ marginTop: 10, color: "#8fba78" }}>NETS {nets.join("  ")}</div>
      </div>
    </div>
  );
}
