export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "AVIOR PCA Back",
    version: "0.1.0",
    description: "Backend (Express + MongoDB) - módulo Marketing"
  },
  servers: [{ url: "http://localhost:3001" }],
  tags: [
    { name: "marketing", description: "Marketing module (generic CRUD)" },
    { name: "operations", description: "Módulo de Operaciones (Vuelos y Notificaciones)" },
    { name: "marketing-analytics", description: "Marketing analytics helpers (metrics + email logs)" }
  ],
  paths: {
    "/health": {
      get: {
        summary: "Healthcheck",
        responses: {
          "200": {
            description: "OK"
          }
        }
      }
    },
    "/api/marketing/{collection}": {
      get: {
        tags: ["marketing"],
        summary: "List documents",
        parameters: [
          {
            name: "collection",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: [
                "campaigns",
                "templates",
                "segments",
                "recipients",
                "flights",
                "notifications",
                "email_logs",
                "metrics"
              ]
            }
          },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "skip", in: "query", schema: { type: "integer", default: 0 } },
          {
            name: "sort",
            in: "query",
            description: "JSON string, e.g. {\"createdAt\":-1}",
            schema: { type: "string" }
          },
          {
            name: "q",
            in: "query",
            description: "Naive regex search across common fields",
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "List result"
          },
          "400": { description: "Invalid collection or query" }
        }
      },
      post: {
        tags: ["marketing"],
        summary: "Create document",
        parameters: [
          {
            name: "collection",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: [
                "campaigns",
                "templates",
                "segments",
                "recipients",
                "flights",
                "notifications",
                "email_logs",
                "metrics"
              ]
            }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: true }
            }
          }
        },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Invalid body" }
        }
      }
    },
    "/api/marketing/{collection}/{id}": {
      get: {
        tags: ["marketing"],
        summary: "Get document by id",
        parameters: [
          {
            name: "collection",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: [
                "campaigns",
                "templates",
                "segments",
                "recipients",
                "flights",
                "notifications",
                "email_logs",
                "metrics"
              ]
            }
          },
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Document" },
          "404": { description: "Not found" },
          "400": { description: "Invalid id" }
        }
      },
      put: {
        tags: ["marketing"],
        summary: "Update document",
        parameters: [
          {
            name: "collection",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: [
                "campaigns",
                "templates",
                "segments",
                "recipients",
                "flights",
                "notifications",
                "email_logs",
                "metrics"
              ]
            }
          },
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: true }
            }
          }
        },
        responses: {
          "200": { description: "Updated" },
          "404": { description: "Not found" },
          "400": { description: "Invalid id/body" }
        }
      },
      delete: {
        tags: ["marketing"],
        summary: "Delete document",
        parameters: [
          {
            name: "collection",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: [
                "campaigns",
                "templates",
                "segments",
                "recipients",
                "flights",
                "notifications",
                "email_logs",
                "metrics"
              ]
            }
          },
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          "204": { description: "Deleted" },
          "404": { description: "Not found" },
          "400": { description: "Invalid id" }
        }
      }
    },
    "/api/operations/{collection}": {
      get: {
        tags: ["operations"],
        summary: "List documents (Operations)",
        parameters: [
          {
            name: "collection",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["flights", "notifications"] }
          }
        ],
        responses: { "200": { description: "OK" } }
      },
      post: {
        tags: ["operations"],
        summary: "Create document (Operations)",
        parameters: [
          {
            name: "collection",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["flights", "notifications"] }
          }
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", additionalProperties: true } } }
        },
        responses: { "201": { description: "Created" } }
      }
    },
    "/api/operations/{collection}/bulk": {
      post: {
        tags: ["operations"],
        summary: "Bulk insert (Operations)",
        parameters: [
          {
            name: "collection",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["flights", "notifications"] }
          }
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "array", items: { type: "object" } } } }
        },
        responses: { "201": { description: "Created" } }
      }
    },
    "/api/operations/{collection}/{id}": {
      get: {
        tags: ["operations"],
        summary: "Get document by id (Operations)",
        parameters: [
          { name: "collection", in: "path", required: true, schema: { type: "string" } },
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "OK" } }
      },
      put: {
        tags: ["operations"],
        summary: "Update document (Operations)",
        parameters: [
          { name: "collection", in: "path", required: true, schema: { type: "string" } },
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: { "200": { description: "Updated" } }
      },
      delete: {
        tags: ["operations"],
        summary: "Delete document (Operations)",
        parameters: [
          { name: "collection", in: "path", required: true, schema: { type: "string" } },
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "204": { description: "Deleted" } }
      }
    },
    "/api/marketing/analytics/{campaignId}": {
      get: {
        tags: ["marketing-analytics"],
        summary: "Get aggregated analytics for a campaign",
        parameters: [
          { name: "campaignId", in: "path", required: true, schema: { type: "string" } },
          {
            name: "includeLogs",
            in: "query",
            required: false,
            description: "If false, skips email_logs aggregation",
            schema: { type: "boolean", default: true }
          }
        ],
        responses: {
          "200": { description: "Analytics" },
          "400": { description: "Invalid campaignId" }
        }
      }
    },
    "/api/marketing/analytics/{campaignId}/logs": {
      get: {
        tags: ["marketing-analytics"],
        summary: "List email logs for a campaign",
        parameters: [
          { name: "campaignId", in: "path", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 200 } },
          { name: "skip", in: "query", schema: { type: "integer", default: 0 } }
        ],
        responses: {
          "200": { description: "Logs list" },
          "400": { description: "Invalid campaignId" }
        }
      }
    },
    "/api/marketing/analytics/{campaignId}/seed": {
      post: {
        tags: ["marketing-analytics"],
        summary: "Seed demo metrics and logs for a campaign",
        parameters: [{ name: "campaignId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: true,
                properties: {
                  sent: { type: "integer", description: "Approximate audience size" }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "Seeded" },
          "400": { description: "Invalid campaignId" }
        }
      }
    }
  }
} as const;
