import React from 'react';
import { calculateStats, convertValue, getStatusColor } from '../db';
import type { SugarReading, ReadingUnit } from '../db';
import { Award, TrendingUp, TrendingDown, RefreshCw, BarChart2 } from 'lucide-react';

interface StatsDashboardProps {
  readings: SugarReading[];
  unit: ReadingUnit;
  onResetMockData: () => void;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ readings, unit, onResetMockData }) => {
  const stats = calculateStats(readings);

  // Helper to convert internal stats (mg/dL) to preferred unit
  const formatStatValue = (valInMgDl: number) => {
    if (unit === 'mg/dL') return valInMgDl;
    return convertValue(valInMgDl, 'mg/dL', 'mmol/L');
  };

  // SVG Gauge calculations
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.inRangePercentage / 100) * circumference;

  // Percentage calculations for breakdown bars
  const getPct = (count: number) => {
    if (stats.totalCount === 0) return 0;
    return Math.round((count / stats.totalCount) * 100);
  };

  return (
    <div className="stats-dashboard">
      {/* Target Range Ring & Distribution Section */}
      <div className="stats-primary-row">
        {/* Ring Card */}
        <div className="dashboard-card target-range-card">
          <div className="card-header-simple">
            <span>IN TARGET RANGE</span>
            <span className="info-badge">70 - 140 {unit}</span>
          </div>

          <div className="gauge-container">
            <svg width="120" height="120" viewBox="0 0 100 100" className="gauge-svg">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="var(--border)"
                strokeWidth="8"
                opacity="0.3"
              />
              {/* Animated foreground arc */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="#10b981"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{
                  transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
            </svg>
            <div className="gauge-center-text">
              <span className="percent-val">{stats.inRangePercentage}%</span>
              <span className="percent-label">Within Target</span>
            </div>
          </div>
          
          <div className="target-comment text-center">
            {stats.inRangePercentage >= 80 ? (
              <span className="text-emerald text-sm font-bold">Excellent glycemic control!</span>
            ) : stats.inRangePercentage >= 60 ? (
              <span className="text-amber text-sm font-bold">Good, target 80%+ if possible.</span>
            ) : stats.totalCount > 0 ? (
              <span className="text-red text-sm font-bold">Consider discussing with doctor.</span>
            ) : (
              <span className="text-muted text-sm">Log values to begin assessment.</span>
            )}
          </div>
        </div>

        {/* Breakdown Card */}
        <div className="dashboard-card breakdown-card">
          <div className="card-header-simple">
            <span>GLUCOSE DISTRIBUTION</span>
            <BarChart2 size={16} className="text-accent" />
          </div>

          <div className="distribution-bars">
            {/* Low */}
            <div className="dist-row">
              <div className="dist-label-row">
                <span className="label">Low (&lt;70)</span>
                <span className="val font-mono">{stats.lowCount} logs ({getPct(stats.lowCount)}%)</span>
              </div>
              <div className="dist-bar-track">
                <div 
                  className="dist-bar-fill" 
                  style={{ width: `${getPct(stats.lowCount)}%`, backgroundColor: getStatusColor('low') }}
                ></div>
              </div>
            </div>

            {/* Normal */}
            <div className="dist-row">
              <div className="dist-label-row">
                <span className="label">Normal (70-140)</span>
                <span className="val font-mono">{stats.normalCount} logs ({getPct(stats.normalCount)}%)</span>
              </div>
              <div className="dist-bar-track">
                <div 
                  className="dist-bar-fill" 
                  style={{ width: `${getPct(stats.normalCount)}%`, backgroundColor: getStatusColor('normal') }}
                ></div>
              </div>
            </div>

            {/* High */}
            <div className="dist-row">
              <div className="dist-label-row">
                <span className="label">High (141-200)</span>
                <span className="val font-mono">{stats.highCount} logs ({getPct(stats.highCount)}%)</span>
              </div>
              <div className="dist-bar-track">
                <div 
                  className="dist-bar-fill" 
                  style={{ width: `${getPct(stats.highCount)}%`, backgroundColor: getStatusColor('high') }}
                ></div>
              </div>
            </div>

            {/* Very High */}
            <div className="dist-row">
              <div className="dist-label-row">
                <span className="label">Very High (&gt;200)</span>
                <span className="val font-mono">{stats.veryHighCount} logs ({getPct(stats.veryHighCount)}%)</span>
              </div>
              <div className="dist-bar-track">
                <div 
                  className="dist-bar-fill" 
                  style={{ width: `${getPct(stats.veryHighCount)}%`, backgroundColor: getStatusColor('very_high') }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Key Numerical Stats */}
      <div className="stats-grid">
        {/* Average Card */}
        <div className="stat-grid-card avg">
          <div className="card-top">
            <Award size={18} className="text-accent" />
            <span className="label">Average Glucose</span>
          </div>
          <div className="card-bottom">
            <span className="number-val">{formatStatValue(stats.average)}</span>
            <span className="unit-label">{unit}</span>
          </div>
        </div>

        {/* Highest Card */}
        <div className="stat-grid-card high">
          <div className="card-top">
            <TrendingUp size={18} className="text-red" />
            <span className="label">Highest Recorded</span>
          </div>
          <div className="card-bottom">
            <span className="number-val">{formatStatValue(stats.highest)}</span>
            <span className="unit-label">{unit}</span>
          </div>
        </div>

        {/* Lowest Card */}
        <div className="stat-grid-card low">
          <div className="card-top">
            <TrendingDown size={18} className="text-cyan" />
            <span className="label">Lowest Recorded</span>
          </div>
          <div className="card-bottom">
            <span className="number-val">{formatStatValue(stats.lowest)}</span>
            <span className="unit-label">{unit}</span>
          </div>
        </div>
      </div>

      {/* Bottom utility tools */}
      <div className="dashboard-utility-bar mt-2">
        <span className="text-xs text-muted">Showing stats computed on device db ({stats.totalCount} readings).</span>
        <button className="btn btn-link btn-xs" onClick={onResetMockData}>
          <RefreshCw size={12} className="mr-1" /> Re-populate Mock Data
        </button>
      </div>
    </div>
  );
};
