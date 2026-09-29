const { calculateCameraSystem } = require('./calculator');

// AWS Lambda calls this function every time a request comes in through API Gateway.
exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const result = calculateCameraSystem(body);
    return response(200, result);
  } catch (err) {
    return response(400, { error: err.message });
  }
};

function response(statusCode, data) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}