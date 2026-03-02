import { Schema, model, Document } from 'mongoose';
import { randomUUID } from 'crypto';

// --- INTERFACES ESTRICTAS ---
// Extendemos de Document para que Mongoose reconozca los métodos de instancia
export interface IOrganization extends Document<string> {
  _id: string; 
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

export interface IUser extends Document<string> {
  _id: string;
  organizationId: string; // Referencia como string (UUID)
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

// --- SCHEMAS ---

const OrganizationSchema = new Schema<IOrganization>({
  // Definimos _id explícitamente como String para UUID
  _id: { type: String, default: () => randomUUID() }, 
  name: { type: String, required: true },
  taxId: { type: String, required: true, unique: true },
  logo: { type: String },
  colors: {
    main: { type: String, required: true },
    secondary: { type: String, required: true },
    accent: { type: String, required: true },
  },
  type: { type: String, enum: ["AIRLINE", "GROUND_HANDLING"], required: true },
  active: { type: Boolean, default: true },
}, { 
  timestamps: true,
  // IMPORTANTE: Evita que Mongoose intente sobrescribir nuestro _id string con un ObjectId
  _id: false 
});

const UserSchema = new Schema<IUser>({
  _id: { type: String, default: () => randomUUID() },
  organizationId: { type: String, required: true, ref: 'Organization' },
  email: { type: String, required: true, unique: true },
  user: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  role: { 
    type: String, 
    enum: ["ADMIN", "PILOT", "GROUND_STAFF", "GATE_AGENT"], 
    required: true 
  },
  fcmToken: { type: String },
  active: { type: Boolean, default: true },
  lastLogin: { type: Date },
}, { 
  timestamps: true, 
  _id: false 
});

// --- MODELOS ---
export const OrganizationModel = model<IOrganization>('Organization', OrganizationSchema);
export const UserModel = model<IUser>('User', UserSchema);