'use strict';

// Minimal Apollo Federation Gateway (PE-103)

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
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
  app.use('/graphql', expressMiddleware(server));

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

