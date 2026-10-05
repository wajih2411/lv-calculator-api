const { calculateCameraSystem, ValidationError } = require('./calculator');
const { saveCalculation, getRecentHistory } = require('./history');

// AWS Lambda calls this function every time a request comes in through API Gateway.
// event.routeKey tells us which route was hit, e.g. "POST /calculate" or "GET /history".
exports.handler = async (event) => {
  try {
    if (event.routeKey === 'GET /history') {
      const limit = parseLimit(event.queryStringParameters?.limit);
      const items = await getRecentHistory(limit);
      return response(200, { count: items.length, items });
    }

    // Default route: POST /calculate
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      throw new ValidationError('Request body must be valid JSON');
    }

    const result = calculateCameraSystem(body);
    const saved = await saveCalculation(result);
    return response(200, { ...saved, ...result });
  } catch (err) {
    if (err instanceof ValidationError) {
      return response(400, { error: err.message });
    }
    // Unexpected problem on our side: log details for CloudWatch, return a generic message.
    console.error(err);
    return response(500, { error: 'Internal server error' });
  }
};

// ?limit=N on GET /history: default 10, max 50.
function parseLimit(raw) {
  if (raw === undefined) return 10;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ValidationError('limit must be a whole number between 1 and 50');
  }
  return limit;
}

function response(statusCode, data) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}
