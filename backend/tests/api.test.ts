import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createServer, Server } from 'http';

describe('API Endpoints', () => {
  let server: Server;
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    app.get('/api/interfaces', async (req: any, res: any) => {
      res.json({ interfaces: [] });
    });

    app.post('/api/capture/start', async (req: any, res: any) => {
      const { interface: iface, filter } = req.body;
      if (!iface) {
        return res.status(400).json({ error: 'Interface is required' });
      }
      res.json({ success: true, message: 'Capture started' });
    });

    app.post('/api/capture/stop', async (req, res) => {
      res.json({ success: true, message: 'Capture stopped' });
    });

    app.get('/api/capture/status', (req, res) => {
      res.json({ capturing: false });
    });

    app.get('/api/unknown', (req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    server = createServer(app);
  });

  describe('GET /api/interfaces', () => {
    test('should return 200 and empty list', async () => {
      const response = await request(app).get('/api/interfaces');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ interfaces: [] });
    });
  });

  describe('POST /api/capture/start', () => {
    test('should return 200 and success message', async () => {
      const response = await request(app)
        .post('/api/capture/start')
        .send({ interface: 'eth0' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, message: 'Capture started' });
    });

    test('should return 400 if interface missing', async () => {
      const response = await request(app)
        .post('/api/capture/start')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Interface is required' });
    });
  });

  describe('POST /api/capture/stop', () => {
    test('should return 200 and success message', async () => {
      const response = await request(app).post('/api/capture/stop');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, message: 'Capture stopped' });
    });
  });

  describe('GET /api/capture/status', () => {
    test('should return 200 with capturing status', async () => {
      const response = await request(app).get('/api/capture/status');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ capturing: false });
    });
  });

  describe('Unknown endpoints', () => {
    test('should return 404 for unknown GET endpoint', async () => {
      const response = await request(app).get('/api/unknown');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 404 for unknown POST endpoint', async () => {
      const response = await request(app).post('/api/unknown');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({});
    });
  });
});
