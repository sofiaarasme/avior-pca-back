// src/modules/admin/collections.ts

export const ADMIN_COLLECTIONS = ["organizations", "users"] as const;

export type AdminCollectionName = (typeof ADMIN_COLLECTIONS)[number];

export function isAdminCollectionName(name: string): name is AdminCollectionName {
  return ADMIN_COLLECTIONS.includes(name as AdminCollectionName);
}

/**
 * Interfaces opcionales para tipado interno (puedes moverlas a src/types)
 */
export interface Organization {
  _id?: any;
  name: string;
  taxId: string;
  logo?: string;
  colors: {
    main: string;
    secondary: string;
    accent: string;
  };
  type: "AIRLINE" | "GROUND_HANDLING";
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  _id?: any;
  organizationId: any; // ObjectId
  email: string;
  user: string;
  password?: string;
  fullName: string;
  role: "ADMIN" | "PILOT" | "GROUND_STAFF" | "GATE_AGENT";
  fcmToken?: string;
  active: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}