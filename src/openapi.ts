export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "AVIOR PCA Back",
    version: "0.1.0",
    description: "Backend (Express + MongoDB) - módulo Marketing"
  },
  components: {
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: { error: { type: "string" } },
        required: ["error"],
      },
      PageInfo: {
        type: "object",
        properties: {
          total: { type: "integer" },
          skip: { type: "integer" },
          limit: { type: "integer" },
        },
        required: ["total", "skip", "limit"],
      },
      ListResponse: {
        type: "object",
        properties: {
          items: { type: "array", items: { type: "object", additionalProperties: true } },
          page: { $ref: "#/components/schemas/PageInfo" },
        },
        required: ["items", "page"],
      },
      SegmentCondition: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          field: { type: "string" },
          operator: { type: "string" },
          value: {},
        },
        required: ["field", "operator"],
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", description: "MongoDB ObjectId" },
          email: { type: "string", format: "email" },
          fullName: { type: "string" },
          role: { 
            type: "string", 
            enum: ["ADMIN", "PILOT", "GROUND_STAFF", "GATE_AGENT"],
            description: "Rol asignado dentro de la operación"
          },
          organizationId: { type: "string", description: "ID de la aerolínea o empresa" },
          active: { type: "boolean" }
        },
        required: ["id", "email", "fullName", "role", "organizationId"]
      },
      Organization: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string" },
          taxId: { type: "string" },
          type: { type: "string", enum: ["AIRLINE", "GROUND_HANDLING"] },
          active: { type: "boolean" }
        }
      },
      Segment: {
        type: "object",
        additionalProperties: true,
        properties: {
          _id: { type: "string", description: "MongoDB ObjectId" },
          name: { type: "string" },
          description: { type: "string" },
          operator: { type: "string", enum: ["AND", "OR"], default: "AND" },
          conditions: { type: "array", items: { $ref: "#/components/schemas/SegmentCondition" } },
          status: { type: "string", enum: ["active", "paused", "archived"], default: "active" },
          audienceSize: { type: "integer" },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
        },
        required: ["name"],
        example: {
          _id: "6650c3b12f2a2c0000000001",
          name: "Clientes frecuentes",
          description: "3+ vuelos en el último año",
          operator: "AND",
          conditions: [{ field: "totalBookings", operator: "greater_than", value: 3 }],
          status: "active",
          audienceSize: 8420,
          createdAt: "2026-01-02T10:00:00.000Z",
          updatedAt: "2026-01-02T10:00:00.000Z",
        },
      },
      NotificationDeliveryStats: {
        type: "object",
        additionalProperties: false,
        properties: {
          sent: { type: "integer" },
          delivered: { type: "integer" },
          failed: { type: "integer" },
        },
      },
      Notification: {
        type: "object",
        additionalProperties: true,
        properties: {
          _id: { type: "string", description: "MongoDB ObjectId" },
          flightId: { type: "string", description: "Foreign identifier for flight (string for now)" },
          type: { type: "string" },
          message: { type: "string" },
          channels: { type: "array", items: { type: "string" } },
          sentAt: { type: "string" },
          deliveryStats: { $ref: "#/components/schemas/NotificationDeliveryStats" },
          createdBy: { type: "string" },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
        },
        required: ["type", "message", "channels"],
        example: {
          _id: "6650c3b12f2a2c0000000100",
          flightId: "fl-001",
          type: "delay",
          message: "Flight AV-102 delayed by 45 minutes",
          channels: ["push", "sms"],
          sentAt: "2026-01-02T10:05:00.000Z",
          deliveryStats: { sent: 0, delivered: 0, failed: 0 },
          createdBy: "ops",
          createdAt: "2026-01-02T10:05:00.000Z",
          updatedAt: "2026-01-02T10:05:00.000Z",
        },
      },
    },
  },
  tags: [
    { name: "auth", description: "Autenticación y Sesión" },
    { name: "marketing", description: "Marketing module (generic CRUD)" },
    { name: "operations", description: "Módulo de Operaciones (Vuelos y Notificaciones)" },
    { name: "marketing-analytics", description: "Marketing analytics helpers (metrics + email logs)" },
    { name: "admin", description: "Módulo de Administración (Organizaciones y Usuarios)" }
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
    "/api/auth/login": {
      post: {
        tags: ["auth"],
        summary: "Iniciar sesión",
        description: "Valida credenciales y devuelve los datos del usuario para el móvil/web",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "piloto@avior.com" },
                  password: { type: "string", example: "123456" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Login exitoso",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    user: { $ref: "#/components/schemas/User" }
                  }
                }
              }
            }
          },
          "401": {
            description: "Credenciales inválidas",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
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
            description: "List result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ListResponse" }
              }
            }
          },
          "400": {
            description: "Invalid collection or query",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          }
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
              schema: {
                oneOf: [
                  { $ref: "#/components/schemas/Segment" },
                  { $ref: "#/components/schemas/Notification" },
                  { type: "object", additionalProperties: true }
                ]
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Created",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true }
              }
            }
          },
          "400": {
            description: "Invalid body",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          }
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
          "200": {
            description: "Document",
            content: { "application/json": { schema: { type: "object", additionalProperties: true } } }
          },
          "404": {
            description: "Not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          },
          "400": {
            description: "Invalid id",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          }
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
              schema: {
                oneOf: [
                  { $ref: "#/components/schemas/Segment" },
                  { $ref: "#/components/schemas/Notification" },
                  { type: "object", additionalProperties: true }
                ]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Updated",
            content: { "application/json": { schema: { type: "object", additionalProperties: true } } }
          },
          "404": {
            description: "Not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          },
          "400": {
            description: "Invalid id/body",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          }
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
          "404": {
            description: "Not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          },
          "400": {
            description: "Invalid id",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
          }
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
            schema: { 
              type: "string", 
              enum: ["flights", "status_history", "assignments", "notifications", "action_logs"] 
            }
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
            schema: { 
              type: "string", 
              enum: ["flights", "status_history", "assignments", "notifications", "action_logs"] 
            }
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
            schema: { 
              type: "string", 
              enum: ["flights", "status_history", "assignments", "notifications", "action_logs"] 
            }
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
    },
    "/api/admin/{collection}": {
      get: {
        tags: ["admin"],
        summary: "List admin documents",
        parameters: [
          {
            name: "collection",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["organizations", "users"] }
          },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "skip", in: "query", schema: { type: "integer", default: 0 } }
        ],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/ListResponse" } } } } }
      },
      post: {
        tags: ["admin"],
        summary: "Create admin document",
        parameters: [
          {
            name: "collection",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["organizations", "users"] }
          }
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: { "201": { description: "Created" } }
      }
    },
    "/api/admin/{collection}/bulk": {
      post: {
        tags: ["admin"],
        summary: "Bulk insert admin documents",
        parameters: [
          {
            name: "collection",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["organizations", "users"] }
          }
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "array", items: { type: "object" } } } }
        },
        responses: { "201": { description: "Created" } }
      }
    },
    "/api/admin/{collection}/{id}": {
      get: {
        tags: ["admin"],
        summary: "Get admin document by id",
        parameters: [
          { name: "collection", in: "path", required: true, schema: { type: "string", enum: ["organizations", "users"] } },
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "OK" } }
      },
      put: {
        tags: ["admin"],
        summary: "Update admin document",
        parameters: [
          { name: "collection", in: "path", required: true, schema: { type: "string", enum: ["organizations", "users"] } },
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: { "200": { description: "Updated" } }
      },
      delete: {
        tags: ["admin"],
        summary: "Delete admin document",
        parameters: [
          { name: "collection", in: "path", required: true, schema: { type: "string", enum: ["organizations", "users"] } },
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "204": { description: "Deleted" } }
      }
    }
  }
} as const;
