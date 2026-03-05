'use strict';

const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
const cw = new CloudWatchClient({ region: process.env.AWS_REGION || 'ap-south-1' });

const NAMESPACE = 'HealthSathi';
const ENV = process.env.ENVIRONMENT || 'prod';

const put = async (metricName, value, unit = 'Count', dims = {}) => {
  const dimensions = Object.entries({ Environment: ENV, ...dims })
    .map(([Name, Value]) => ({ Name, Value: String(Value) }));
  try {
    await cw.send(new PutMetricDataCommand({
      Namespace: NAMESPACE,
      MetricData: [{ MetricName: metricName, Value: value, Unit: unit, Dimensions: dimensions, Timestamp: new Date() }],
    }));
  } catch (e) {
    // metrics are best-effort — never fail the main flow
    console.warn('[METRICS] Failed to publish metric:', e.message);
  }
};

module.exports = { put };
