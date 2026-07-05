import React, { useState } from 'react';
import { convertValue, getStatusColor, getContextLabel } from '../db';
import type { SugarReading, ReadingUnit } from '../db';
import { Activity } from 'lucide-react';

interface BloodSugarChartProps {
  readings: SugarReading[];
  unit: ReadingUnit;
}

export const BloodSugarChart: React.FC<BloodSugarChartProps> = ({ readings, unit }) => {
  const [timeframe, setTimeframe] = useState<'7d' | '14d' | '30d' | 'all'>('7d');
  const [hoveredPoint, setHoveredPoint] = useState<{ reading: SugarReading; x: number; y: number } | null>(null);

  // 1. Filter readings based on timeframe
  const getFilteredReadings = () => {
    const now = new Date();
    let cutoff = new Date();

    if (timeframe === '7d') cutoff.setDate(now.getDate() - 7);
    else if (timeframe === '14d') cutoff.setDate(now.getDate() - 14);
    else if (timeframe === '30d') cutoff.setDate(now.getDate() - 30);
    else return [...readings].reverse(); // oldest first for chronological chart

    return readings
      .filter(r => new Date(r.measuredAt) >= cutoff)
      .reverse(); // oldest first for chronological chart
  };

  const chartData = getFilteredReadings();

  if (chartData.length === 0) {
    return (
      <div className="chart-card empty-state">
        <Activity size={40} className="text-muted mb-2 animate-pulse" />
        <p className="title">No data for this period</p>
        <p className="desc">Log your first blood sugar readings to see trend analysis.</p>
        <div className="timeframe-selector mt-4">
          {(['7d', '14d', '30d', 'all'] as const).map(tf => (
            <button
              key={tf}
              className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 2. Chart configurations
  const width = 600;
  const height = 260;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Values are stored in mg/dL internally. We calculate min/max in mg/dL, then convert labels if needed.
  const values = chartData.map(d => d.value);
  const maxVal = Math.max(220, ...values) + 20; // Ensure some headroom
  const minVal = Math.max(30, Math.min(60, ...values) - 20); // Keep above extreme lows or set floor at 30

  // Helper scales
  const getX = (index: number) => {
    if (chartData.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (chartData.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return height - paddingBottom - ((val - minVal) / (maxVal - minVal)) * chartHeight;
  };

  // 3. Grid line values (in mg/dL)
  const gridLines = [70, 140, 200];
  if (maxVal > 250) gridLines.push(250);
  if (minVal < 50) gridLines.unshift(50);

  // Generate SVG path for the line
  let pathD = '';
  let areaD = '';

  if (chartData.length > 0) {
    chartData.forEach((d, idx) => {
      const cx = getX(idx);
      const cy = getY(d.value);
      if (idx === 0) {
        pathD = `M ${cx} ${cy}`;
        areaD = `M ${cx} ${height - paddingBottom} L ${cx} ${cy}`;
      } else {
        pathD += ` L ${cx} ${cy}`;
        areaD += ` L ${cx} ${cy}`;
      }
    });

    if (chartData.length > 0) {
      const lastX = getX(chartData.length - 1);
      const firstX = getX(0);
      areaD += ` L ${lastX} ${height - paddingBottom} L ${firstX} ${height - paddingBottom} Z`;
    }
  }

  // Target range boundaries in Y coordinates (mg/dL thresholds: 70 to 140)
  const targetMinY = getY(70);
  const targetMaxY = getY(140);
  const targetBandHeight = targetMinY - targetMaxY; // Higher blood sugar = lower Y value

  const handlePointHover = (reading: SugarReading, index: number) => {
    const cx = getX(index);
    const cy = getY(reading.value);
    setHoveredPoint({ reading, x: cx, y: cy });
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-title">
          <Activity size={18} className="text-accent" />
          <span>Glucose Trend</span>
        </div>
        <div className="timeframe-selector">
          {(['7d', '14d', '30d', 'all'] as const).map(tf => (
            <button
              key={tf}
              className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-canvas-container" style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" className="chart-svg">
          <defs>
            {/* Soft gradient under line */}
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
            </linearGradient>
            
            {/* Glowing filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. Target Range Band (70 - 140 mg/dL) */}
          {targetMaxY >= paddingTop && targetMinY <= height - paddingBottom && (
            <rect
              x={paddingLeft}
              y={targetMaxY}
              width={chartWidth}
              height={targetBandHeight}
              fill="rgba(16, 185, 129, 0.05)"
              stroke="rgba(16, 185, 129, 0.12)"
              strokeDasharray="2,2"
            />
          )}

          {/* 2. Grid lines & Y Axis labels */}
          {gridLines.map((lineVal) => {
            const yPos = getY(lineVal);
            if (yPos < paddingTop || yPos > height - paddingBottom) return null;
            
            const displayVal = unit === 'mg/dL' 
              ? lineVal 
              : convertValue(lineVal, 'mg/dL', 'mmol/L');

            return (
              <g key={lineVal} className="grid-group">
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={width - paddingRight}
                  y2={yPos}
                  stroke="var(--border)"
                  strokeOpacity="0.4"
                  strokeDasharray="4,4"
                />
                <text
                  x={paddingLeft - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text)"
                  opacity="0.6"
                >
                  {displayVal}
                </text>
              </g>
            );
          })}

          {/* Target range indicator labels on the right edge */}
          <text
            x={width - paddingRight - 4}
            y={getY(140) + 12}
            textAnchor="end"
            fontSize="8"
            fontWeight="bold"
            fill="#10b981"
            opacity="0.6"
          >
            TARGET CEILING
          </text>
          <text
            x={width - paddingRight - 4}
            y={getY(70) - 4}
            textAnchor="end"
            fontSize="8"
            fontWeight="bold"
            fill="#10b981"
            opacity="0.6"
          >
            TARGET FLOOR
          </text>

          {/* 3. Gradient area path */}
          {chartData.length > 1 && (
            <path d={areaD} fill="url(#chartGradient)" />
          )}

          {/* 4. Core trend line path */}
          {chartData.length > 1 && (
            <path
              d={pathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glow)"
            />
          )}

          {/* 5. Interactive data points */}
          {chartData.map((d, idx) => {
            const cx = getX(idx);
            const cy = getY(d.value);
            const dotColor = getStatusColor(d.value < 70 ? 'low' : d.value <= 140 ? 'normal' : d.value <= 200 ? 'high' : 'very_high');
            const isHovered = hoveredPoint?.reading.id === d.id;

            return (
              <g 
                key={d.id} 
                className="chart-dot-group"
                onMouseEnter={() => handlePointHover(d, idx)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {/* Transparent helper circle for easier hovering */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="16"
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                />
                
                {/* Outer ring on hover */}
                {isHovered && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="8"
                    fill="none"
                    stroke={dotColor}
                    strokeWidth="1.5"
                    opacity="0.5"
                    className="ping-animation"
                  />
                )}
                
                {/* Inner dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5 : 3.5}
                  fill="var(--bg)"
                  stroke={dotColor}
                  strokeWidth="2.5"
                  style={{ transition: 'all 0.15s ease' }}
                />
              </g>
            );
          })}

          {/* 6. X Axis Labels (dates) */}
          {chartData.length > 0 && (() => {
            // Decimate X-axis labels to avoid crowding
            const stride = Math.max(1, Math.floor(chartData.length / 5));
            return chartData.map((d, idx) => {
              if (idx % stride !== 0 && idx !== chartData.length - 1) return null;
              return (
                <text
                  key={`lbl-${d.id}`}
                  x={getX(idx)}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--text)"
                  opacity="0.6"
                >
                  {formatDate(d.measuredAt)}
                </text>
              );
            });
          })()}
        </svg>

        {/* 7. Hover Tooltip Div */}
        {hoveredPoint && (() => {
          const r = hoveredPoint.reading;
          const displayVal = unit === 'mg/dL' 
            ? r.value 
            : convertValue(r.value, 'mg/dL', 'mmol/L');
          const status = r.value < 70 ? 'low' : r.value <= 140 ? 'normal' : r.value <= 200 ? 'high' : 'very_high';
          const dotColor = getStatusColor(status);

          // Position tooltip to avoid overflowing chart canvas
          const tooltipWidth = 130;
          const isOnRightHalf = hoveredPoint.x > width / 2;
          const leftPos = isOnRightHalf 
            ? `calc(${hoveredPoint.x / width * 100}% - ${tooltipWidth + 10}px)` 
            : `calc(${hoveredPoint.x / width * 100}% + 10px)`;

          return (
            <div
              className="chart-tooltip"
              style={{
                position: 'absolute',
                left: leftPos,
                top: `${(hoveredPoint.y / height) * 100 - 15}%`,
                zIndex: 10,
                borderLeft: `3px solid ${dotColor}`
              }}
            >
              <div className="tooltip-value">
                <span className="val">{displayVal}</span>
                <span className="unit">{unit}</span>
              </div>
              <div className="tooltip-context">{getContextLabel(r.context)}</div>
              <div className="tooltip-time">
                {formatDate(r.measuredAt)} at {formatTime(r.measuredAt)}
              </div>
              {r.notes && <div className="tooltip-notes">"{r.notes}"</div>}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
