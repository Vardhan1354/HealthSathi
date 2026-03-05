'use strict';

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { ok, serverError, parseBody } = require('/opt/nodejs/response');
const metrics = require('/opt/nodejs/metrics');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'ap-south-1' });

// ─── DBSCAN HELPERS ──────────────────────────────────────────────────────────

// Haversine distance between two lat/lon points in metres
function haversine(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const s = Math.sin(dLat/2)**2 +
            Math.cos(a.lat * Math.PI/180) * Math.cos(b.lat * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function findNeighbors(report, all, epsilon) {
  return all.filter(r => r.id !== report.id && haversine(report.location, r.location) <= epsilon);
}

function expandCluster(seed, neighbors, all, epsilon, visited) {
  const cluster = [seed];
  const queue   = [...neighbors];
  visited.add(seed.id);

  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    cluster.push(current);

    const newNeighbors = findNeighbors(current, all, epsilon);
    if (newNeighbors.length >= 3) {
      queue.push(...newNeighbors.filter(n => !visited.has(n.id)));
    }
  }
  return cluster;
}

function getMostCommonSymptom(reports) {
  const freq = {};
  reports.forEach(r => (r.symptoms || []).forEach(s => { freq[s] = (freq[s] || 0) + 1; }));
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
}

function calculateCentroid(reports) {
  const n = reports.length;
  return {
    lat: reports.reduce((s, r) => s + r.location.lat, 0) / n,
    lon: reports.reduce((s, r) => s + r.location.lon, 0) / n,
  };
}

function getTimeSpan(reports) {
  const ts = reports.map(r => r.timestamp);
  return Math.max(...ts) - Math.min(...ts);
}

function detectGeographicClusters(reports, epsilon = 2000, minPoints = 5) {
  const clusters = [];
  const visited  = new Set();

  for (const report of reports) {
    if (visited.has(report.id)) continue;
    const neighbors = findNeighbors(report, reports, epsilon);
    if (neighbors.length >= minPoints) {
      const cluster = expandCluster(report, neighbors, reports, epsilon, visited);
      clusters.push({
        village: report.village,
        doctorId: report.doctorId,
        caseCount: cluster.length,
        primarySymptom: getMostCommonSymptom(cluster),
        reports: cluster,
        centroid: calculateCentroid(cluster),
      });
    }
  }
  return clusters;
}

// ─── SEVERITY & RECOMMENDATIONS ──────────────────────────────────────────────

function getSeverity(caseCount, symptom) {
  if (caseCount >= 15) return 'critical';
  if (caseCount >= 10) return 'high';
  if (caseCount >= 5)  return 'medium';
  return 'low';
}

const RECOMMENDATIONS = {
  fever:    'Arrange fever camp. Check for malaria/dengue. Distribute ORS.',
  cough:    'Screen for TB. Arrange chest camp. Notify district TB officer.',
  diarrhoea:'Distribute ORS. Test water source. Arrange dehydration camp.',
  vomiting: 'Check food/water source. Distribute ORS. Alert PHC.',
  rash:     'Check for chickenpox/measles. Isolate cases. Notify IDSP.',
  default:  'Organise health camp. Collect samples. Notify PHC medical officer.',
};

function getRecommendation(cluster) {
  return RECOMMENDATIONS[cluster.primarySymptom.toLowerCase()] || RECOMMENDATIONS.default;
}

function generateId() {
  return `OB-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}

// ─── SNS NOTIFICATION ────────────────────────────────────────────────────────

async function notifyDoctor(doctorId, alert) {
  const topicArn = process.env.DOCTOR_ALERTS_TOPIC;
  if (!topicArn) return;
  const msg = `[HealthSathi Alert] ${alert.severity.toUpperCase()}: ${alert.caseCount} cases of ${alert.symptom} in ${alert.village}. Action: ${alert.recommendation}`;
  try {
    await sns.send(new PublishCommand({
      TopicArn: topicArn,
      Message: msg,
      Subject: `HealthSathi: ${alert.severity} outbreak - ${alert.village}`,
      MessageAttributes: {
        doctorId: { DataType: 'String', StringValue: doctorId },
        severity: { DataType: 'String', StringValue: alert.severity },
      },
    }));
  } catch (e) {
    console.warn('[SNS] Notification failed:', e.message);
  }
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

exports.handler = async (event, context) => {
  try {
    const { symptomReports = [], epsilon = 2000, minPoints = 5 } = parseBody(event);
    if (!symptomReports.length) return ok({ clusters: [], alerts: [] });

    // Ensure all reports have ids
    const reports = symptomReports.map((r, i) => ({ id: r.id || `r-${i}`, ...r }));

    const clusters = detectGeographicClusters(reports, epsilon, minPoints);

    // Filter to outbreaks within 7 days
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const outbreaks  = clusters.filter(c => getTimeSpan(c.reports) <= SEVEN_DAYS);

    const alerts = [];
    for (const outbreak of outbreaks) {
      const severity = getSeverity(outbreak.caseCount, outbreak.primarySymptom);
      const alert = {
        id:             generateId(),
        village:        outbreak.village,
        caseCount:      outbreak.caseCount,
        symptom:        outbreak.primarySymptom,
        severity,
        recommendation: getRecommendation(outbreak),
        centroid:       outbreak.centroid,
        timestamp:      Date.now(),
      };
      alerts.push(alert);
      if (outbreak.doctorId) await notifyDoctor(outbreak.doctorId, alert);
    }

    await metrics.put('OutbreaksDetected', outbreaks.length);
    await metrics.put('AlertsGenerated', alerts.length);

    return ok({ clusters: outbreaks.map(c => ({ ...c, reports: undefined })), alerts });

  } catch (err) {
    return serverError(err, context);
  }
};
