import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { convertValue, getStatusColor } from '../db';
import type { SugarReading, ReadingUnit } from '../db';

interface BloodSugarChartProps {
  readings: SugarReading[];
  unit: ReadingUnit;
}

export const BloodSugarChart: React.FC<BloodSugarChartProps> = ({ readings, unit }) => {
  const [timeframe, setTimeframe] = useState<'7d' | '14d' | '30d' | 'all'>('7d');
  const [selectedPoint, setSelectedPoint] = useState<SugarReading | null>(null);

  const getFilteredReadings = () => {
    const now = new Date();
    let cutoff = new Date();

    if (timeframe === '7d') cutoff.setDate(now.getDate() - 7);
    else if (timeframe === '14d') cutoff.setDate(now.getDate() - 14);
    else if (timeframe === '30d') cutoff.setDate(now.getDate() - 30);
    else return [...readings].reverse();

    return readings
      .filter(r => new Date(r.measuredAt) >= cutoff)
      .reverse();
  };

  const chartData = getFilteredReadings();

  if (chartData.length === 0) {
    return (
      <View style={[styles.card, styles.emptyState]}>
        <Text style={styles.title}>No data for this period</Text>
        <Text style={styles.desc}>Log your first blood sugar readings to see trend analysis.</Text>
        <View style={styles.timeframeSelector}>
          {(['7d', '14d', '30d', 'all'] as const).map(tf => (
            <TouchableOpacity
              key={tf}
              style={[styles.tfBtn, timeframe === tf && styles.tfBtnActive]}
              onPress={() => setTimeframe(tf)}
            >
              <Text style={[styles.tfBtnText, timeframe === tf && styles.tfBtnTextActive]}>
                {tf.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  const screenWidth = Dimensions.get('window').width - 32; // padding 16 each side
  const width = screenWidth;
  const height = 220;
  const paddingLeft = 32;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 24;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const values = chartData.map(d => d.value);
  const dataMax = Math.max(...values);
  const dataMin = Math.min(...values);

  const maxVal = Math.max(160, dataMax + 10);
  const minVal = Math.max(40, Math.min(60, dataMin - 10));

  const getX = (index: number) => {
    if (chartData.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (chartData.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return height - paddingBottom - ((val - minVal) / (maxVal - minVal)) * chartHeight;
  };

  const formatDisplayValue = (valInMgDl: number) => {
    if (unit === 'mg/dL') return Math.round(valInMgDl);
    return convertValue(valInMgDl, 'mg/dL', 'mmol/L');
  };

  // Build SVG Path points
  let pathD = '';
  let areaD = '';

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
    if (idx === chartData.length - 1) {
      areaD += ` L ${cx} ${height - paddingBottom} Z`;
    }
  });

  const gridLines = [70, 140];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.cardTitle}>GLUCOSE TRENDS</Text>
        <View style={styles.timeframeSelectorHeader}>
          {(['7d', '14d', '30d', 'all'] as const).map(tf => (
            <TouchableOpacity
              key={tf}
              style={[styles.tfBtnSmall, timeframe === tf && styles.tfBtnSmallActive]}
              onPress={() => setTimeframe(tf)}
            >
              <Text style={[styles.tfBtnSmallText, timeframe === tf && styles.tfBtnSmallTextActive]}>
                {tf.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.chartContainer}>
        <Svg width={width} height={height}>
          {/* Target Range shading */}
          <Rect
            x={paddingLeft}
            y={getY(140)}
            width={chartWidth}
            height={getY(70) - getY(140)}
            fill="rgba(16, 185, 129, 0.05)"
          />

          {/* Grid lines */}
          {gridLines.map((gl) => (
            <React.Fragment key={gl}>
              <Line
                x1={paddingLeft}
                y1={getY(gl)}
                x2={width - paddingRight}
                y2={getY(gl)}
                stroke="rgba(255, 255, 255, 0.1)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            </React.Fragment>
          ))}

          {/* Line & Area */}
          {chartData.length > 1 && (
            <>
              <Path d={areaD} fill="rgba(139, 92, 246, 0.08)" />
              <Path d={pathD} fill="none" stroke="#8b5cf6" strokeWidth="2.5" />
            </>
          )}

          {/* Data Points */}
          {chartData.map((d, idx) => {
            const cx = getX(idx);
            const cy = getY(d.value);
            const statusColor = getStatusColor(d.value < 70 ? 'low' : d.value <= 140 ? 'normal' : d.value <= 200 ? 'high' : 'very_high');

            return (
              <Circle
                key={d.id}
                cx={cx}
                cy={cy}
                r={selectedPoint?.id === d.id ? "7" : "4.5"}
                fill={statusColor}
                stroke="#0a0b10"
                strokeWidth="2"
                onPress={() => setSelectedPoint(d)}
              />
            );
          })}
        </Svg>

        {/* Custom Y-Axis Labels */}
        <View style={[styles.yAxis, { height: chartHeight, top: paddingTop }]}>
          <Text style={styles.yAxisText}>{formatDisplayValue(140)}</Text>
          <Text style={styles.yAxisText}>{formatDisplayValue(70)}</Text>
        </View>
      </View>

      {selectedPoint && (
        <View style={styles.tooltipContainer}>
          <View style={styles.tooltipContent}>
            <Text style={styles.tooltipTitle}>
              {new Date(selectedPoint.measuredAt).toLocaleDateString()} at{' '}
              {new Date(selectedPoint.measuredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.tooltipValue}>
              {formatDisplayValue(selectedPoint.value)} {unit} ({selectedPoint.context.replace('_', ' ')})
            </Text>
            {selectedPoint.notes ? (
              <Text style={styles.tooltipNotes}>"{selectedPoint.notes}"</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => setSelectedPoint(null)} style={styles.tooltipClose}>
            <Text style={styles.tooltipCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#141620',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  title: {
    color: '#f3f4f6',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  desc: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timeframeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  tfBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  tfBtnActive: {
    backgroundColor: '#8b5cf6',
  },
  tfBtnText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tfBtnTextActive: {
    color: '#ffffff',
  },
  timeframeSelectorHeader: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 2,
  },
  tfBtnSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 18,
  },
  tfBtnSmallActive: {
    backgroundColor: '#8b5cf6',
  },
  tfBtnSmallText: {
    color: '#6b7280',
    fontSize: 9,
    fontWeight: 'bold',
  },
  tfBtnSmallTextActive: {
    color: '#ffffff',
  },
  chartContainer: {
    position: 'relative',
  },
  yAxis: {
    position: 'absolute',
    left: 4,
    justifyContent: 'space-between',
    width: 24,
  },
  yAxisText: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tooltipContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1a1d2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tooltipContent: {
    flex: 1,
  },
  tooltipTitle: {
    color: '#6b7280',
    fontSize: 10,
    marginBottom: 2,
  },
  tooltipValue: {
    color: '#f3f4f6',
    fontSize: 13,
    fontWeight: 'bold',
  },
  tooltipNotes: {
    color: '#9ca3af',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  tooltipClose: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tooltipCloseText: {
    color: '#8b5cf6',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
