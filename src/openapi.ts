export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "AVIOR PCA Back",
    version: "0.1.0",
    description: "Backend (Express + MongoDB) - módulo Marketing"
  },
  servers: [{ url: "http://localhost:3001" }],
  tags: [{ name: "marketing", description: "Marketing module (generic CRUD)" }],
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
    }
  }
} as const;
