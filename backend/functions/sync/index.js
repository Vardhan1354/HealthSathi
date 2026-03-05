'use strict';

const { put, get, query, batchWrite } = require('/opt/nodejs/db');
const { ok, badRequest, serverError, parseBody } = require('/opt/nodejs/response');
const metrics = require('/opt/nodejs/metrics');

// ─── TYPE HANDLERS ───────────────────────────────────────────────────────────

async function saveMedicineScan(data) {
  const now = Date.now();
  const item = {
    PK: `USER#${data.userId}`,
    SK: `SCAN#${new Date(now).toISOString().slice(0,10)}#${data.id}`,
    GSI1PK: `VILLAGE#${data.villageId || 'unknown'}`,
    GSI1SK: `SCAN#${new Date(now).toISOString().slice(0,10)}`,
    type: 'medicine_scan',
    category: data.category,
    isCounterfeit: data.isCounterfeit || false,
    confidence: data.confidence || 0,
    imagePath: data.imagePath || null,
    medicineName: data.medicineName,
    timestamp: now,
  };
  await put(item);
  if (data.isCounterfeit) await metrics.put('CounterfeitDetected', 1, 'Count', { village: data.villageId });
  await metrics.put('MedicineScanned', 1);
}

async function createDoctorRequest(data) {
  const now = Date.now();
  const item = {
    PK: `VILLAGE#${data.villageId}`,
    SK: `REQUEST#${new Date(now).toISOString().slice(0,10)}#${data.id}`,
    GSI1PK: `DOCTOR#${data.doctorId}`,
    GSI1SK: `REQUEST#${new Date(now).toISOString().slice(0,10)}`,
    type: 'doctor_request',
    patientId: data.patientId,
    patientName: data.patientName,
    symptoms: data.symptoms || [],
    priority: data.priority || 'medium',
    status: 'pending',
    timestamp: now,
  };
  await put(item);
  await metrics.put('DoctorRequestCreated', 1, 'Count', { priority: data.priority || 'medium' });
}

async function logCounterfeitReport(data) {
  const now = Date.now();
  const item = {
    PK: `COUNTERFEIT#${data.batchNo || data.id}`,
    SK: `REPORT#${new Date(now).toISOString().slice(0,10)}#${data.id}`,
    GSI1PK: `VILLAGE#${data.villageId || 'unknown'}`,
    GSI1SK: `COUNTERFEIT#${new Date(now).toISOString().slice(0,10)}`,
    type: 'counterfeit_report',
    medicineName: data.medicineName,
    batchNo: data.batchNo,
    manufacturer: data.manufacturer,
    pharmacyLocation: data.pharmacyLocation,
    reportedBy: data.userId,
    imagePath: data.imagePath,
    timestamp: now,
  };
  await put(item);
  await metrics.put('CounterfeitReported', 1);
}

async function saveDoctorVisit(data) {
  const now = Date.now();
  const item = {
    PK: `DOCTOR#${data.doctorId}`,
    SK: `VISIT#${new Date(now).toISOString().slice(0,10)}#${data.id}`,
    GSI1PK: `VILLAGE#${data.villageId}`,
    GSI1SK: `VISIT#${new Date(now).toISOString().slice(0,10)}`,
    type: 'doctor_visit',
    villageId: data.villageId,
    villageName: data.villageName,
    patients: data.patients || [],
    notes: data.notes,
    status: data.status || 'completed',
    timestamp: now,
  };
  await put(item);
  await metrics.put('DoctorVisitLogged', 1);
}

const HANDLERS = {
  medicine_scan: saveMedicineScan,
  doctor_request: createDoctorRequest,
  counterfeit_report: logCounterfeitReport,
  visit_log: saveDoctorVisit,
};

// ─── GET UPDATES FOR USER ────────────────────────────────────────────────────

async function getUpdatesForUser(userId) {
  const since = Date.now() - 24 * 60 * 60 * 1000; // last 24h
  const { items } = await query({
    KeyConditionExpression: 'PK = :pk AND SK > :since',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':since': `SCAN#${new Date(since).toISOString().slice(0,10)}`,
    },
  });
  return items;
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

exports.handler = async (event, context) => {
  try {
    const { userId, syncQueue } = parseBody(event);
    if (!userId)      return badRequest('userId is required');
    if (!Array.isArray(syncQueue)) return badRequest('syncQueue must be an array');

    // Sort by priority (urgent → high → medium → low) then timestamp
    const PRIORITY = { urgent: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...syncQueue].sort((a, b) => {
      const pd = (PRIORITY[a.priority] ?? 2) - (PRIORITY[b.priority] ?? 2);
      return pd !== 0 ? pd : a.timestamp - b.timestamp;
    });

    const results = [];
    const errors  = [];

    for (const item of sorted) {
      const handler = HANDLERS[item.type];
      if (!handler) {
        errors.push({ id: item.id, error: `Unknown type: ${item.type}` });
        continue;
      }
      try {
        await handler({ ...item.data, id: item.id, userId });
        results.push({ id: item.id, synced: true });
      } catch (err) {
        console.error(`[SYNC] Failed item ${item.id}:`, err);
        errors.push({ id: item.id, synced: false, error: err.message });
      }
    }

    const updates = await getUpdatesForUser(userId);
    await metrics.put('SyncCompleted', 1, 'Count', { status: errors.length ? 'partial' : 'success' });

    return ok({
      results,
      errors,
      updates,
      serverTimestamp: Date.now(),
    });

  } catch (err) {
    return serverError(err, context);
  }
};
