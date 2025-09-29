import request from 'supertest';
import app from '../../src/index';

describe('Health Check Endpoints', () => {
  describe('GET /health', () => {
    it('should return 200 status code', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    it('should return ok status', async () => {
      const response = await request(app).get('/health');
      expect(response.body.status).toBe('ok');
    });

    it('should include timestamp', async () => {
      const response = await request(app).get('/health');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should include service name', async () => {
      const response = await request(app).get('/health');
      expect(response.body.service).toBe('plasma-engine-gateway');
    });
  });

  describe('GET /ready', () => {
    it('should return 200 status code', async () => {
      const response = await request(app).get('/ready');
      expect(response.status).toBe(200);
    });

    it('should return ready status', async () => {
      const response = await request(app).get('/ready');
      expect(response.body.status).toBe('ready');
    });
  });

  describe('GET /metrics', () => {
    it('should return 200 status code', async () => {
      const response = await request(app).get('/metrics');
      expect(response.status).toBe(200);
    });

    it('should include uptime', async () => {
      const response = await request(app).get('/metrics');
      expect(response.body.uptime).toBeDefined();
      expect(typeof response.body.uptime).toBe('number');
    });

    it('should include memory usage', async () => {
      const response = await request(app).get('/metrics');
      expect(response.body.memory).toBeDefined();
      expect(response.body.memory.heapUsed).toBeDefined();
    });
  });
});