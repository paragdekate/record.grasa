import React, { useState } from 'react';
import { convertValue, getStatusColor, getContextLabel } from '../db';
import type { SugarReading, ReadingUnit } from '../db';
import { Activity, Maximize2, RotateCw, X } from 'lucide-react';

interface BloodSugarChartProps {
  readings: SugarReading[];
  unit: ReadingUnit;
}

export const BloodSugarChart: React.FC<BloodSugarChartProps> = ({ readings, unit }) => {
  const [timeframe, setTimeframe] = useState<'7d' | '14d' | '30d' | 'all'>('7d');
  const [hoveredPoint, setHoveredPoint] = useState<{ reading: SugarReading; x: number; y: number } | null>(null);
  
  // Custom states for Expand, Rotation, and Legends Click
  const [isExpanded, setIsExpanded] = useState(false);
  const [isForceLandscape, setIsForceLandscape] = useState(false);
  const [selectedReading, setSelectedReading] = useState<SugarReading | null>(null);

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
  const height = 300; // Increased height to reduce vertical squishing
  const paddingLeft = 10; // Minimal margins for edge-to-edge plot area
  const paddingRight = 10;
  const paddingTop = 12;
  const paddingBottom = 16;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Values are stored in mg/dL internally. We calculate min/max in mg/dL, then convert labels if needed.
  const values = chartData.map(d => d.value);
  const dataMax = Math.max(...values);
  const dataMin = Math.min(...values);

  // Dynamically adjust scale to match actual readings while keeping target range (70-140) visible
  const maxVal = Math.max(150, dataMax + 10);
  const minVal = Math.max(35, Math.min(65, dataMin - 10));

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

  // Target range boundaries in Y coordinates
  const targetMinY = getY(70);
  const targetMaxY = getY(140);

  const handlePointHover = (reading: SugarReading, index: number) => {
    const cx = getX(index);
    const cy = getY(reading.value);
    setHoveredPoint({ reading, x: cx, y: cy });
  };

  const handlePointClick = (reading: SugarReading) => {
    setSelectedReading(reading);
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const renderSVGChartContent = () => (
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

      {/* 1. Target Range Boundary Lines (No fill to keep background unified with card) */}
      {targetMaxY >= paddingTop && targetMinY <= height - paddingBottom && (
        <>
          <line
            x1={paddingLeft}
            y1={targetMaxY}
            x2={width - paddingRight}
            y2={targetMaxY}
            stroke="#10b981"
            strokeWidth="1"
            strokeDasharray="3,3"
            opacity="0.3"
          />
          <line
            x1={paddingLeft}
            y1={targetMinY}
            x2={width - paddingRight}
            y2={targetMinY}
            stroke="#10b981"
            strokeWidth="1"
            strokeDasharray="3,3"
            opacity="0.3"
          />
        </>
      )}

      {/* 2. Horizontal Base Line (no vertical Y-axis line for clean, modern look) */}
      <line
        x1={paddingLeft}
        y1={height - paddingBottom}
        x2={width - paddingRight}
        y2={height - paddingBottom}
        stroke="var(--border-color)"
        strokeWidth="1"
        opacity="0.3"
      />

      {/* Y-Axis Unit Label inside graph area */}
      <text
        x={paddingLeft + 4}
        y={paddingTop - 4}
        textAnchor="start"
        fontSize="8"
        fontWeight="800"
        fill="var(--text-secondary)"
        opacity="0.7"
        letterSpacing="0.5"
      >
        {unit.toUpperCase()}
      </text>

      {/* Grid lines & Y Axis labels inside graph area */}
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
              strokeOpacity="0.2"
              strokeDasharray="4,4"
            />
            <text
              x={paddingLeft + 4}
              y={yPos - 4}
              textAnchor="start"
              fontSize="9"
              fontWeight="bold"
              fill="var(--text-secondary)"
              opacity="0.7"
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

      {/* 3. Gradient area path (removed to keep background uniform with card) */}

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
        const isSelected = selectedReading?.id === d.id;
        const dotColor = getStatusColor(d.value < 70 ? 'low' : d.value <= 140 ? 'normal' : d.value <= 200 ? 'high' : 'very_high');
        const isHovered = hoveredPoint?.reading.id === d.id;

        return (
          <g 
            key={d.id} 
            className="chart-dot-group"
            onMouseEnter={() => handlePointHover(d, idx)}
            onMouseLeave={() => setHoveredPoint(null)}
            onClick={() => handlePointClick(d)}
          >
            {/* Transparent helper circle for easier tapping/hovering */}
            <circle
              cx={cx}
              cy={cy}
              r="16"
              fill="transparent"
              style={{ cursor: 'pointer' }}
            />
            
            {/* Outer ring on hover */}
            {(isHovered || isSelected) && (
              <circle
                cx={cx}
                cy={cy}
                r={isSelected ? 10 : 8}
                fill="none"
                stroke={dotColor}
                strokeWidth={isSelected ? "2" : "1.5"}
                strokeDasharray={isSelected ? "2,2" : "none"}
                opacity="0.7"
                className={isSelected ? "" : "ping-animation"}
              />
            )}
            
            {/* Inner dot */}
            <circle
              cx={cx}
              cy={cy}
              r={isSelected ? 5.5 : isHovered ? 5 : 3.5}
              fill="var(--bg)"
              stroke={dotColor}
              strokeWidth="2.5"
              style={{ transition: 'all 0.15s ease' }}
            />
          </g>
        );
      })}

      {/* 6. X Axis Labels (dates) & Ticks */}
      {chartData.length > 0 && (() => {
        // Decimate X-axis labels to avoid crowding
        const stride = Math.max(1, Math.floor(chartData.length / 5));
        return chartData.map((d, idx) => {
          const xPos = getX(idx);
          const isLabelVisible = idx % stride === 0 || idx === chartData.length - 1;
          
          return (
            <g key={`lbl-grp-${d.id}`}>
              {/* X Axis Tick */}
              <line
                x1={xPos}
                y1={height - paddingBottom}
                x2={xPos}
                y2={height - paddingBottom + 4}
                stroke="var(--border-color)"
                strokeWidth="1"
                opacity="0.5"
              />
              
              {isLabelVisible && (
                <text
                  x={xPos}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--text)"
                  opacity="0.6"
                >
                  {formatDate(d.measuredAt)}
                </text>
              )}
            </g>
          );
        });
      })()}
    </svg>
  );

  return (
    <div className="chart-card">
      
      {/* Chart Widget Header */}
      <div className="chart-header">
        <div className="chart-title">
          <Activity size={18} className="text-accent" />
          <span>Glucose Trend</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

          <button 
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsExpanded(true)}
            style={{ padding: '6px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent' }}
            title="Expand Chart View"
          >
            <Maximize2 size={14} className="text-secondary" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="chart-canvas-container" style={{ position: 'relative' }}>
        {renderSVGChartContent()}

        {/* Hover Tooltip Div */}
        {hoveredPoint && (() => {
          const r = hoveredPoint.reading;
          const displayVal = unit === 'mg/dL' ? r.value : convertValue(r.value, 'mg/dL', 'mmol/L');
          const status = r.value < 70 ? 'low' : r.value <= 140 ? 'normal' : r.value <= 200 ? 'high' : 'very_high';
          const dotColor = getStatusColor(status);
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
            </div>
          );
        })()}
      </div>

      {/* 4. selectedReading Details Legend panel */}
      {selectedReading && (
        <div style={{
          marginTop: '12px',
          marginLeft: '12px',
          marginRight: '12px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '12px 14px',
          animation: 'fadeIn 0.2s ease-out',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.8px' }}>
              📊 LOG DETAILS LEGEND
            </span>
            <button 
              onClick={() => setSelectedReading(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}
            >
              CLEAR
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: getStatusColor(
                  selectedReading.value < 70 ? 'low' : selectedReading.value <= 140 ? 'normal' : selectedReading.value <= 200 ? 'high' : 'very_high'
                ),
                boxShadow: `0 0 10px ${getStatusColor(
                  selectedReading.value < 70 ? 'low' : selectedReading.value <= 140 ? 'normal' : selectedReading.value <= 200 ? 'high' : 'very_high'
                )}`
              }} />
              <div>
                <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {unit === 'mg/dL' ? selectedReading.value : convertValue(selectedReading.value, 'mg/dL', 'mmol/L')}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '4px', fontWeight: '600' }}>
                  {unit} <span style={{ color: 'var(--text-muted)' }}>({getContextLabel(selectedReading.context)})</span>
                </span>
              </div>
            </div>
            
            <div style={{ textAlign: 'right', fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '130%' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{formatDate(selectedReading.measuredAt)}</div>
              <div>{formatTime(selectedReading.measuredAt)}</div>
            </div>
          </div>
          {selectedReading.notes && (
            <p style={{ 
              fontSize: '10px', 
              color: 'var(--text-muted)', 
              fontStyle: 'italic', 
              marginTop: '4px', 
              borderTop: '1px dashed var(--border-color)', 
              paddingTop: '6px',
              lineHeight: '140%'
            }}>
              Notes: "{selectedReading.notes}"
            </p>
          )}
        </div>
      )}

      {/* Fullscreen Overlay Modal (Expand / Landscape) */}
      {isExpanded && (
        <div 
          className="chart-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(10, 11, 16, 0.98)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            padding: 'calc(16px + env(safe-area-inset-top, 0px)) calc(24px + env(safe-area-inset-right, 0px)) calc(16px + env(safe-area-inset-bottom, 0px)) calc(24px + env(safe-area-inset-left, 0px))',
            boxSizing: 'border-box'
          }}
        >
          {/* Modal content wrapper (supports transform rotate) */}
          <div 
            className={`chart-modal-container ${isForceLandscape ? 'force-landscape' : ''}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              height: '100%',
              gap: '12px',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Modal Header Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} className="text-accent" />
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Expanded Trend Analysis</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsForceLandscape(!isForceLandscape)}
                  style={{ gap: '4px', padding: '6px 12px' }}
                >
                  <RotateCw size={14} className={isForceLandscape ? 'spin' : ''} />
                  <span>{isForceLandscape ? 'Portrait' : 'Rotate Landscape'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setIsExpanded(false);
                    setIsForceLandscape(false);
                  }}
                  style={{ padding: '6px', borderRadius: '50%' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* SVG Chart Body inside Modal */}
            <div style={{ flex: 1, position: 'relative', minHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {renderSVGChartContent()}
            </div>

            {/* Details panel inside Expanded Modal (Legend) */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '14px',
              marginTop: 'auto'
            }}>
              {selectedReading ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.8px' }}>
                      📊 GLUCOSE POINT LEGEND
                    </span>
                    <button 
                      onClick={() => setSelectedReading(null)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}
                    >
                      CLEAR
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: getStatusColor(
                          selectedReading.value < 70 ? 'low' : selectedReading.value <= 140 ? 'normal' : selectedReading.value <= 200 ? 'high' : 'very_high'
                        ),
                        boxShadow: `0 0 8px ${getStatusColor(
                          selectedReading.value < 70 ? 'low' : selectedReading.value <= 140 ? 'normal' : selectedReading.value <= 200 ? 'high' : 'very_high'
                        )}`
                      }} />
                      <div>
                        <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>
                          {unit === 'mg/dL' ? selectedReading.value : convertValue(selectedReading.value, 'mg/dL', 'mmol/L')}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '4px', fontWeight: 'bold' }}>
                          {unit} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({getContextLabel(selectedReading.context)})</span>
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '10px', color: 'var(--text-secondary)' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{formatDate(selectedReading.measuredAt)}</div>
                      <div>{formatTime(selectedReading.measuredAt)}</div>
                    </div>
                  </div>
                  {selectedReading.notes && (
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '6px', borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                      Notes: "{selectedReading.notes}"
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '6px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                  💡 <strong>Tap any data point</strong> in the chart above to display its detailed information legend here.
                </div>
              )}
            </div>

          </div>

          {/* Embedded rotation stylesheet rules */}
          <style>{`
            .chart-modal-container.force-landscape {
              width: 100vh !important;
              height: 100vw !important;
              transform: rotate(90deg);
              transform-origin: center center;
              position: absolute;
              top: 50%;
              left: 50%;
              margin-left: -50vh;
              margin-top: -50vw;
            }
          `}</style>
        </div>
      )}

    </div>
  );
};
