import type { ServiceDefinition } from "@apollo/gateway";
import type { ServiceConfig } from "./settings.js";

/**
 * buildServiceList converts our strongly-typed configuration into the structure Apollo
 * Gateway expects. Keeping the transformation in one file makes it simple to plug in
 * future service discovery (Consul, AWS App Registry, etc.).
 */
export function buildServiceList(config: ServiceConfig): ServiceDefinition[] {
  return config.downstreamServices.map((service) => ({
    name: service.name,
    url: service.url,
  }));
}

