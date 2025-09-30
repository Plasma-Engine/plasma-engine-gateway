'use strict';

// Minimal Apollo Federation Gateway (PE-103)

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloGateway, IntrospectAndCompose } = require('@apollo/gateway');

function parseServiceList() {
  // SERVICES env: comma-separated name=url pairs, e.g.
  // USERS=http://users:4001,CONTENT=http://content:4002
  const env = process.env.SERVICES || '';
  return env
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const [name, url] = pair.split('=');
      return { name, url };
    });
}

function verifyJWT(token) {
  try {
    // Use same secret as FastAPI backend
    const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    return jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'plasma-engine-gateway',
      audience: 'plasma-engine'
    });
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

function extractTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

async function start() {
  const serviceList = parseServiceList();

  const supergraphSdl = new IntrospectAndCompose({
    subgraphs: serviceList,
  });

  const gateway = new ApolloGateway({
    supergraphSdl,
    serviceHealthCheck: true,
  });

  const server = new ApolloServer({
    gateway,
    introspection: true,
  });

  await server.start();

  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  
  // Add authentication context to GraphQL
  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => {
      const token = extractTokenFromHeader(req.headers.authorization);
      
      if (!token) {
        // Allow introspection queries without auth in development
        if (process.env.NODE_ENV !== 'production') {
          return { user: null };
        }
        throw new Error('Authentication required');
      }
      
      try {
        const user = verifyJWT(token);
        return { user };
      } catch (error) {
        throw new Error('Authentication failed: ' + error.message);
      }
    }
  }));

  const port = process.env.PORT || 4000;
  app.listen({ port }, () => {
    // eslint-disable-next-line no-console
    console.log(`Apollo Gateway running on http://0.0.0.0:${port}/graphql`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start Apollo Gateway', err);
  process.exit(1);
});

