'use strict';

const { get, queryAll, queryGSI1 } = require('/opt/nodejs/db');
const { ok, notFound, serverError } = require('/opt/nodejs/response');
const metrics = require('/opt/nodejs/metrics');

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function nDaysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function sortByPriority(requests) {
  const ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
  return [...requests].sort((a, b) => {
    const p = (ORDER[a.priority] ?? 2) - (ORDER[b.priority] ?? 2);
    return p !== 0 ? p : b.timestamp - a.timestamp;
  });
}

// ─── DATA FETCHERS ───────────────────────────────────────────────────────────

async function getPatientRequests(villages, days = 7) {
  const since = nDaysAgo(days);
  const all   = [];
  await Promise.all(villages.map(async v => {
    const { items } = await queryGSI1(`VILLAGE#${v}`, `REQUEST#${since}`, 50);
    all.push(...items);
  }));
  return sortByPriority(all);
}

async function getHealthTrends(villages, days = 7) {
  const since = nDaysAgo(days);
  const scans = [];
  await Promise.all(villages.map(async v => {
    const { items } = await queryGSI1(`VILLAGE#${v}`, `SCAN#${since}`, 100);
    scans.push(...items);
  }));

  // Build 7-day bucket
  const byDay = {};
  for (let d = 0; d < days; d++) {
    const day = nDaysAgo(days - 1 - d);
    byDay[day] = { date: day, scans: 0, counterfeits: 0, requests: 0 };
  }
  scans.forEach(s => {
    const day = new Date(s.timestamp).toISOString().slice(0, 10);
    if (byDay[day]) {
      byDay[day].scans++;
      if (s.isCounterfeit) byDay[day].counterfeits++;
    }
  });

  // Top symptoms from requests (reuse scans for now — extend when symptom data available)
  const symptomFreq = {};
  scans.forEach(s => {
    if (s.category) symptomFreq[s.category] = (symptomFreq[s.category] || 0) + 1;
  });
  const topSymptoms = Object.entries(symptomFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    daily: Object.values(byDay),
    topSymptoms,
    totalScans: scans.length,
  };
}

async function getActiveAlerts(villages) {
  const since = nDaysAgo(3); // last 3 days
  const alerts = [];
  await Promise.all(villages.map(async v => {
    const { items } = await queryGSI1(`VILLAGE#${v}`, `ALERT#${since}`, 20);
    alerts.push(...items.filter(i => i.type === 'alert'));
  }));
  return alerts;
}

async function getMedicineStats(villages) {
  const since = nDaysAgo(30);
  let scans = 0, counterfeits = 0, prescriptions = 0;
  await Promise.all(villages.map(async v => {
    const items = await queryAll({ IndexName: 'GSI1', KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)', ExpressionAttributeValues: { ':pk': `VILLAGE#${v}`, ':prefix': `SCAN#${since.slice(0,7)}` } });
    items.forEach(i => {
      scans++;
      if (i.isCounterfeit) counterfeits++;
      if (i.type === 'prescription_scan') prescriptions++;
    });
  }));
  return { scans, counterfeits, prescriptions };
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

exports.handler = async (event, context) => {
  try {
    const doctorId = event.pathParameters?.doctorId;
    if (!doctorId) return notFound('doctorId is required');

    const doctor = await get(`USER#${doctorId}`, 'METADATA');
    if (!doctor) return notFound(`Doctor ${doctorId} not found`);

    const villages = doctor.villages || [];

    // Fetch all data in parallel
    const [requests, trends, alerts, stats] = await Promise.all([
      getPatientRequests(villages),
      getHealthTrends(villages, 7),
      getActiveAlerts(villages),
      getMedicineStats(villages),
    ]);

    const dashboard = {
      doctor: { id: doctorId, name: doctor.name, villages },
      requests: {
        urgent:  requests.filter(r => r.priority === 'urgent'),
        medium:  requests.filter(r => r.priority === 'medium'),
        low:     requests.filter(r => r.priority === 'low'),
        total:   requests.length,
      },
      trends: {
        period: 'Last 7 days',
        daily:  trends.daily,
        topSymptoms: trends.topSymptoms,
        totalScans:  trends.totalScans,
      },
      alerts: alerts.map(a => ({
        type:           a.alertType || a.type,
        village:        a.village,
        severity:       a.severity,
        message:        a.message,
        actionRequired: a.actionRequired || true,
        timestamp:      a.timestamp,
      })),
      stats: {
        medicineScans:    stats.scans,
        counterfeitsFound: stats.counterfeits,
        prescriptionsRead: stats.prescriptions,
      },
      syncStatus: {
        online: true,
        lastSynced: Date.now(),
      },
      lastUpdated: Date.now(),
    };

    await metrics.put('DashboardFetched', 1);
    return ok(dashboard);

  } catch (err) {
    return serverError(err, context);
  }
};
