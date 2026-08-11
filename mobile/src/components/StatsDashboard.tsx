import React from 'react';
import { StyleSheet, View, Text, ScrollView, Dimensions, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { calculateStats, convertValue, getStatusColor } from '../db';
import type { SugarReading, ReadingUnit } from '../db';

interface StatsDashboardProps {
  readings: SugarReading[];
  unit: ReadingUnit;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ readings, unit }) => {
  const stats = calculateStats(readings);

  const formatStatValue = (valInMgDl: number) => {
    if (unit === 'mg/dL') return valInMgDl;
    return convertValue(valInMgDl, 'mg/dL', 'mmol/L');
  };

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.inRangePercentage / 100) * circumference;

  const getPct = (count: number) => {
    if (stats.totalCount === 0) return 0;
    return Math.round((count / stats.totalCount) * 100);
  };

  const getTargetMessage = () => {
    if (stats.inRangePercentage >= 80) return { text: 'Excellent glycemic control!', color: '#10b981' };
    if (stats.inRangePercentage >= 60) return { text: 'Good, target 80%+', color: '#f59e0b' };
    if (stats.totalCount > 0) return { text: 'Consider discussing with doctor.', color: '#ef4444' };
    return { text: 'Log values to begin assessment.', color: '#6b7280' };
  };

  const targetMsg = getTargetMessage();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.primaryRow}>
        {/* Ring Card */}
        <View style={[styles.card, styles.targetRangeCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>IN TARGET RANGE</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>70-140 {unit}</Text>
            </View>
          </View>

          <View style={styles.gaugeContainer}>
            <Svg width="120" height="120" viewBox="0 0 100 100" style={styles.gaugeSvg}>
              <Circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="8"
              />
              <Circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="#10b981"
                strokeWidth="8"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                rotation="-90"
                origin="50, 50"
              />
            </Svg>
            <View style={styles.gaugeCenterText}>
              <Text style={styles.percentVal}>{stats.inRangePercentage}%</Text>
              <Text style={styles.percentLabel}>In Target</Text>
            </View>
          </View>

          <Text style={[styles.targetComment, { color: targetMsg.color }]}>
            {targetMsg.text}
          </Text>
        </View>

        {/* Breakdown Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>GLUCOSE DISTRIBUTION</Text>
          </View>

          <View style={styles.distributionBars}>
            {[
              { label: 'Low (<70)', count: stats.lowCount, key: 'low' as const },
              { label: 'Normal (70-140)', count: stats.normalCount, key: 'normal' as const },
              { label: 'High (141-200)', count: stats.highCount, key: 'high' as const },
              { label: 'Very High (>200)', count: stats.veryHighCount, key: 'very_high' as const },
            ].map(item => (
              <View key={item.key} style={styles.distRow}>
                <View style={styles.distLabelRow}>
                  <Text style={styles.distLabel}>{item.label}</Text>
                  <Text style={styles.distVal}>
                    {item.count} ({getPct(item.count)}%)
                  </Text>
                </View>
                <View style={styles.distBarTrack}>
                  <View
                    style={[
                      styles.distBarFill,
                      {
                        width: `${getPct(item.count)}%`,
                        backgroundColor: getStatusColor(item.key),
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Grid of Key Numerical Stats */}
      <View style={styles.statsGrid}>
        <View style={[styles.statGridCard, styles.avgCard]}>
          <Text style={styles.gridLabel}>Average Glucose</Text>
          <View style={styles.gridValueRow}>
            <Text style={styles.gridNumber}>{formatStatValue(stats.average)}</Text>
            <Text style={styles.gridUnit}>{unit}</Text>
          </View>
        </View>

        <View style={[styles.statGridCard, styles.highCard]}>
          <Text style={styles.gridLabel}>Highest Recorded</Text>
          <View style={styles.gridValueRow}>
            <Text style={styles.gridNumber}>{formatStatValue(stats.highest)}</Text>
            <Text style={styles.gridUnit}>{unit}</Text>
          </View>
        </View>

        <View style={[styles.statGridCard, styles.lowCard]}>
          <Text style={styles.gridLabel}>Lowest Recorded</Text>
          <View style={styles.gridValueRow}>
            <Text style={styles.gridNumber}>{formatStatValue(stats.lowest)}</Text>
            <Text style={styles.gridUnit}>{unit}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.footerText}>
        Showing stats computed on device db ({stats.totalCount} readings).
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b10',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  primaryRow: {
    gap: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#141620',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  targetRangeCard: {
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  cardTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
  },
  gaugeContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: 120,
    height: 120,
  },
  gaugeSvg: {
    position: 'absolute',
  },
  gaugeCenterText: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentVal: {
    color: '#f3f4f6',
    fontSize: 24,
    fontWeight: '800',
  },
  percentLabel: {
    color: '#6b7280',
    fontSize: 10,
  },
  targetComment: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
  },
  distributionBars: {
    gap: 12,
  },
  distRow: {
    width: '100%',
  },
  distLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  distLabel: {
    color: '#f3f4f6',
    fontSize: 12,
  },
  distVal: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  distBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  distBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statGridCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#141620',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  avgCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#8b5cf6',
  },
  highCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  lowCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#06b6d4',
  },
  gridLabel: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 4,
  },
  gridValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  gridNumber: {
    color: '#f3f4f6',
    fontSize: 22,
    fontWeight: '800',
  },
  gridUnit: {
    color: '#6b7280',
    fontSize: 12,
  },
  footerText: {
    color: '#6b7280',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
});
