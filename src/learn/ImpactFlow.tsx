const DUR = 4;

const wide = {
  consumers: [60, 140, 220, 300].map((cy, i) => ({
    cy,
    label: i === 2 ? "Unregistered consumer" : "Consumer service",
    unregistered: i === 2,
  })),
};

const narrow = {
  consumers: [52, 140, 228, 316].map((cx, i) => ({
    cx,
    label: i === 2 ? "Unregistered" : "Service",
    unregistered: i === 2,
  })),
};

function Gate({ x, y }: { x: number; y: number }) {
  return (
    <g aria-hidden="true">
      <rect x={x - 38} y={y - 70} width="14" height="140" rx="3" className="flow-post" />
      <rect x={x + 24} y={y - 70} width="14" height="140" rx="3" className="flow-post" />
      <text x={x} y={y + 100} textAnchor="middle" className="flow-label strong">
        Impact Gate
      </text>
    </g>
  );
}

export default function ImpactFlow() {
  return (
    <div className="impact-flow" role="img" aria-label="Animated diagram: an API change passes the Impact Gate and its impact travels to downstream consumers, including one that was never registered.">
      <svg className="flow-svg flow-wide" viewBox="0 0 960 360" aria-hidden="true">
        <rect x="30" y="140" width="170" height="80" rx="10" className="flow-node-static" />
        <text x="115" y="176" textAnchor="middle" className="flow-label strong">
          API change
        </text>
        <text x="115" y="198" textAnchor="middle" className="flow-label">
          contract updated
        </text>
        <Gate x={420} y={180} />
        {wide.consumers.map((c, i) => {
          const d = `M200 180 L382 180 M458 180 C580 180 620 ${c.cy} 740 ${c.cy}`;
          const motion = `M200 180 L420 180 C580 180 620 ${c.cy} 740 ${c.cy}`;
          return (
            <g key={c.cy}>
              <path d={d} className="flow-line" />
              <rect
                x="740"
                y={c.cy - 24}
                width="190"
                height="48"
                rx="8"
                className={c.unregistered ? "flow-node unregistered" : "flow-node"}
                style={{ animationDelay: `${i * 1}s` }}
              />
              <text x="835" y={c.cy + 5} textAnchor="middle" className="flow-label strong">
                {c.label}
              </text>
              <circle r="6" className="flow-dot">
                <animateMotion
                  dur={`${DUR}s`}
                  begin={`${i * 1}s`}
                  repeatCount="indefinite"
                  path={motion}
                  keyTimes="0;1"
                  calcMode="linear"
                />
              </circle>
            </g>
          );
        })}
      </svg>

      <svg className="flow-svg flow-narrow" viewBox="0 0 360 460" aria-hidden="true">
        <rect x="95" y="14" width="170" height="64" rx="10" className="flow-node-static" />
        <text x="180" y="42" textAnchor="middle" className="flow-label strong">
          API change
        </text>
        <text x="180" y="62" textAnchor="middle" className="flow-label">
          contract updated
        </text>
        <g aria-hidden="true">
          <rect x="108" y="150" width="62" height="12" rx="3" className="flow-post" />
          <rect x="190" y="150" width="62" height="12" rx="3" className="flow-post" />
          <text x="180" y="186" textAnchor="middle" className="flow-label strong">
            Impact Gate
          </text>
        </g>
        {narrow.consumers.map((c, i) => {
          const d = `M180 78 L180 144 M180 168 C180 270 ${c.cx} 290 ${c.cx} 380`;
          const motion = `M180 78 L180 156 C180 270 ${c.cx} 290 ${c.cx} 380`;
          return (
            <g key={c.cx}>
              <path d={d} className="flow-line" />
              <rect
                x={c.cx - 40}
                y="380"
                width="80"
                height="48"
                rx="8"
                className={c.unregistered ? "flow-node unregistered" : "flow-node"}
                style={{ animationDelay: `${i * 1}s` }}
              />
              <text x={c.cx} y="409" textAnchor="middle" className="flow-label strong small">
                {c.label}
              </text>
              <circle r="5" className="flow-dot">
                <animateMotion
                  dur={`${DUR}s`}
                  begin={`${i * 1}s`}
                  repeatCount="indefinite"
                  path={motion}
                  keyTimes="0;1"
                  calcMode="linear"
                />
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
