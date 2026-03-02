import { Schema, model, Document } from 'mongoose';
import { randomUUID } from 'crypto';

// --- OPCIONES COMUNES PARA UUID ---
const schemaOptions = { 
  timestamps: true, 
  _id: false 
};

// --- INTERFACES ---

export interface IFlight extends Document<string> {
  _id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  status: "ON_TIME" | "DELAYED" | "CANCELLED" | "LANDED";
  organizationId?: string;
  version: number;
  createdBy: string;
  updatedBy?: string;
}

export interface INotification extends Document<string> {
  _id: string;
  type: string;
  message: string;
  flightId?: string;
  organizationId?: string;
  createdBy: string;
}

export interface IStatusHistory extends Document<string> {
  _id: string;
  organizationId?: string;
  flightId?: string;
  status: string;
  timestamp: Date;
  user: string;
  remarks?: string;
  notificationId?: string;
}

export interface IAssignment extends Document<string> {
  _id: string;
  userId: string;
  flightId: string;
  roleInFlight: string;
}

// --- SCHEMAS ---

const FlightSchema = new Schema<IFlight>({
  _id: { type: String, default: () => randomUUID() },
  flightNumber: { type: String, required: true, index: true },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  status: { 
    type: String, 
    enum: ["ON_TIME", "DELAYED", "CANCELLED", "LANDED"], 
    default: "ON_TIME",
    index: true 
  },
  organizationId: { type: String, index: true },
  version: { type: Number, default: 1 },
  createdBy: { type: String, required: true },
  updatedBy: { type: String },
}, schemaOptions);

const NotificationSchema = new Schema<INotification>({
  _id: { type: String, default: () => randomUUID() },
  type: { type: String, required: true, index: true },
  message: { type: String, required: true },
  flightId: { type: String, index: true },
  organizationId: { type: String, index: true },
  createdBy: { type: String, required: true },
}, schemaOptions);

const StatusHistorySchema = new Schema<IStatusHistory>({
  _id: { type: String, default: () => randomUUID() },
  organizationId: { type: String, index: true },
  flightId: { type: String, index: true },
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: -1 },
  user: { type: String, required: true },
  remarks: { type: String },
  notificationId: { type: String },
}, { timestamps: true, _id: false });

const AssignmentSchema = new Schema<IAssignment>({
  _id: { type: String, default: () => randomUUID() },
  userId: { type: String, required: true, index: true },
  flightId: { type: String, required: true, index: true },
  roleInFlight: { type: String, required: true },
}, schemaOptions);

// --- MODELOS ---

export const FlightModel = model<IFlight>('Flight', FlightSchema);
export const NotificationModel = model<INotification>('Notification', NotificationSchema);
export const StatusHistoryModel = model<IStatusHistory>('StatusHistory', StatusHistorySchema);
export const AssignmentModel = model<IAssignment>('Assignment', AssignmentSchema);
