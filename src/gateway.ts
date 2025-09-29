/**
 * Enhanced Apollo GraphQL Gateway with TypeScript
 * 
 * Features:
 * - Service discovery with health checks
 * - Circuit breaker pattern
 * - Request/response logging
 * - Metrics collection
 * - Advanced error handling
 * - JWT authentication integration
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { readFileSync } from 'fs';
import { createClient, RedisClientType } from 'redis';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import pino from 'pino';

// Types
interface ServiceConfig {
  name: string;
  url: string;
  healthCheck?: string;
}

interface AuthContext {
  user?: {
    id: string;
    roles: string[];
    email: string;
  };
  isAuthenticated: boolean;
}

interface GatewayMetrics {
  requests: number;
  errors: number;
  serviceHealth: Record<string, boolean>;
  lastUpdate: Date;
}

// Configuration
const config = {
  port: parseInt(process.env.PORT || '4000'),
  environment: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'development-secret-key',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  services: parseServiceList(),
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
  },
  healthCheck: {
    timeout: 5000,
    retries: 3,
  },
};

// Logger
const logger = pino({
  level: config.environment === 'development' ? 'debug' : 'info',
  transport: config.environment === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined,
});

// Redis client for caching and service discovery
let redisClient: RedisClientType;

// Metrics storage
const metrics: GatewayMetrics = {
  requests: 0,
  errors: 0,
  serviceHealth: {},
  lastUpdate: new Date(),
};

/**
 * Parse service configuration from environment variables
 * Format: SERVICE_NAME=http://service:port,ANOTHER_SERVICE=http://another:port
 */
function parseServiceList(): ServiceConfig[] {
  const servicesEnv = process.env.SERVICES || '';
  
  if (!servicesEnv) {
    logger.warn('No services configured in SERVICES environment variable');
    return [];
  }

  return servicesEnv
    .split(',')
    .map(pair => pair.trim())
    .filter(Boolean)
    .map(pair => {
      const [name, url] = pair.split('=');
      if (!name || !url) {
        logger.error(`Invalid service configuration: ${pair}`);
        return null;
      }
      
      return {
        name: name.toUpperCase(),
        url: url.trim(),
        healthCheck: `${url.trim()}/health`,
      };
    })
    .filter((service): service is ServiceConfig => service !== null);
}

/**
 * Enhanced data source with authentication and error handling
 */
class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  willSendRequest({ request, context }: any) {
    // Forward authentication headers
    if (context.user) {
      request.http.headers.set('x-user-id', context.user.id);
      request.http.headers.set('x-user-roles', context.user.roles.join(','));
    }

    // Add correlation ID for tracing
    const correlationId = context.correlationId || generateCorrelationId();
    request.http.headers.set('x-correlation-id', correlationId);

    logger.debug(`Forwarding request to ${this.url}`, {
      correlationId,
      userId: context.user?.id,
    });
  }

  async didReceiveResponse({ response, request, context }: any) {
    const correlationId = context.correlationId;
    
    if (response.http.status >= 400) {
      logger.error(`Service error from ${this.url}`, {
        correlationId,
        status: response.http.status,
        url: request.http.url,
      });
      
      metrics.errors++;
    }

    return response;
  }

  async didEncounterError(error: any, request: any) {
    logger.error(`Service error: ${error.message}`, {
      service: this.url,
      error: error.stack,
    });
    
    metrics.errors++;
    return error;
  }
}

/**
 * JWT Authentication middleware
 */
async function authenticateRequest(req: express.Request): Promise<AuthContext> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isAuthenticated: false };
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    
    // Check if token is blacklisted (optional Redis check)
    if (redisClient) {
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return { isAuthenticated: false };
      }
    }

    return {
      user: {
        id: decoded.sub,
        roles: decoded.roles || [],
        email: decoded.email,
      },
      isAuthenticated: true,
    };
  } catch (error) {
    logger.debug(`JWT verification failed: ${error.message}`);
    return { isAuthenticated: false };
  }
}

/**
 * Health check for individual services
 */
async function checkServiceHealth(service: ServiceConfig): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.healthCheck.timeout);
    
    const response = await fetch(service.healthCheck!, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    
    clearTimeout(timeoutId);
    
    const isHealthy = response.ok;
    metrics.serviceHealth[service.name] = isHealthy;
    
    if (!isHealthy) {
      logger.warn(`Service ${service.name} health check failed`, {
        status: response.status,
        url: service.healthCheck,
      });
    }
    
    return isHealthy;
  } catch (error) {
    logger.error(`Service ${service.name} health check error: ${error.message}`);
    metrics.serviceHealth[service.name] = false;
    return false;
  }
}

/**
 * Periodic health checks for all services
 */
async function startHealthChecks() {
  const checkInterval = 30000; // 30 seconds
  
  setInterval(async () => {
    logger.debug('Running service health checks');
    
    const healthPromises = config.services.map(service => 
      checkServiceHealth(service).catch(() => false)
    );
    
    await Promise.all(healthPromises);
    metrics.lastUpdate = new Date();
    
    // Log unhealthy services
    const unhealthyServices = Object.entries(metrics.serviceHealth)
      .filter(([_, healthy]) => !healthy)
      .map(([name]) => name);
      
    if (unhealthyServices.length > 0) {
      logger.warn('Unhealthy services detected', { services: unhealthyServices });
    }
  }, checkInterval);
}

/**
 * Generate correlation ID for request tracing
 */
function generateCorrelationId(): string {
  return `gw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create and configure the Apollo Gateway
 */
async function createGateway(): Promise<ApolloGateway> {
  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: config.services.map(service => ({
        name: service.name,
        url: service.url,
      })),
    }),
    serviceHealthCheck: true,
    buildService({ url }) {
      return new AuthenticatedDataSource({ url });
    },
  });

  // Handle gateway errors
  gateway.onSchemaLoadOrUpdate((result) => {
    if (result.isSuccessResult) {
      logger.info('Gateway schema updated successfully');
    } else {
      logger.error('Gateway schema update failed', { errors: result.errors });
    }
  });

  return gateway;
}

/**
 * Create and configure the Express application
 */
async function createApp(): Promise<express.Application> {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // CORS middleware
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  }));

  // Rate limiting
  app.use(rateLimit(config.rateLimiting));

  // Request logging middleware
  app.use((req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
    req.correlationId = correlationId;
    
    logger.info(`${req.method} ${req.path}`, {
      correlationId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    metrics.requests++;
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    const healthyServices = Object.values(metrics.serviceHealth).filter(Boolean).length;
    const totalServices = Object.keys(metrics.serviceHealth).length;
    
    const health = {
      status: healthyServices === totalServices ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: metrics.serviceHealth,
      metrics: {
        requests: metrics.requests,
        errors: metrics.errors,
        uptime: process.uptime(),
      },
      version: process.env.npm_package_version || '1.0.0',
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  // Readiness probe
  app.get('/ready', (req, res) => {
    const allServicesHealthy = Object.values(metrics.serviceHealth).every(Boolean);
    
    if (allServicesHealthy || Object.keys(metrics.serviceHealth).length === 0) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ 
        status: 'not ready', 
        reason: 'Some services are unhealthy',
        services: metrics.serviceHealth 
      });
    }
  });

  // Metrics endpoint
  app.get('/metrics', (req, res) => {
    res.json({
      ...metrics,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: config.environment,
    });
  });

  return app;
}

/**
 * Initialize Redis connection
 */
async function initializeRedis() {
  try {
    redisClient = createClient({ url: config.redisUrl });
    
    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis');
    });

    await redisClient.connect();
  } catch (error) {
    logger.warn(`Redis connection failed: ${error.message}. Continuing without cache.`);
  }
}

/**
 * Main server startup function
 */
async function startServer() {
  try {
    logger.info('Starting Plasma Engine Gateway', {
      environment: config.environment,
      port: config.port,
      services: config.services.length,
    });

    // Initialize Redis (optional)
    await initializeRedis();

    // Create Express app
    const app = await createApp();

    // Create and start Apollo Gateway
    const gateway = await createGateway();
    const server = new ApolloServer({
      gateway,
      introspection: config.environment !== 'production',
      plugins: [
        {
          requestDidStart() {
            return {
              didResolveOperation(requestContext) {
                logger.debug(`GraphQL operation: ${requestContext.request.operationName}`, {
                  correlationId: requestContext.contextValue.correlationId,
                });
              },
              didEncounterErrors(requestContext) {
                logger.error('GraphQL errors', {
                  errors: requestContext.errors,
                  correlationId: requestContext.contextValue.correlationId,
                });
                metrics.errors++;
              },
            };
          },
        },
      ],
    });

    await server.start();

    // GraphQL endpoint with authentication
    app.use('/graphql', expressMiddleware(server, {
      context: async ({ req }) => {
        const auth = await authenticateRequest(req);
        return {
          ...auth,
          correlationId: req.correlationId || generateCorrelationId(),
        };
      },
    }));

    // Start health checks
    await startHealthChecks();

    // Start HTTP server
    const httpServer = app.listen(config.port, '0.0.0.0', () => {
      logger.info(`🚀 Gateway ready at http://0.0.0.0:${config.port}/graphql`);
      logger.info(`📊 Health checks at http://0.0.0.0:${config.port}/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      
      httpServer.close(() => {
        logger.info('HTTP server closed');
      });

      await server.stop();
      
      if (redisClient) {
        await redisClient.quit();
      }
      
      process.exit(0);
    });

  } catch (error) {
    logger.error(`Failed to start gateway: ${error.message}`, { stack: error.stack });
    process.exit(1);
  }
}

// Export for testing
export { 
  createApp, 
  createGateway, 
  authenticateRequest, 
  checkServiceHealth,
  config 
};

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}