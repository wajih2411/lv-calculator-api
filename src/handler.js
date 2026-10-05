const { calculateCameraSystem, ValidationError } = require('./calculator');

// AWS Lambda calls this function every time a request comes in through API Gateway.
exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      throw new ValidationError('Request body must be valid JSON');
    }

    const result = calculateCameraSystem(body);
    return response(200, result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return response(400, { error: err.message });
    }
    // Unexpected problem on our side: log details for CloudWatch, return a generic message.
    console.error(err);
    return response(500, { error: 'Internal server error' });
  }
};

function response(statusCode, data) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}
