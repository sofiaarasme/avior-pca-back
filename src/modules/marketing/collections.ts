import { Schema, model, Document } from 'mongoose';
import { randomUUID } from 'crypto';

// --- INTERFACES ---
// Extendemos Document<string> para usar UUIDs en lugar de ObjectIds

export interface ICampaign extends Document<string> {
  _id: string;
  name: string;
  subject: string;
  templateId: string;
  segmentId: string;
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "ARCHIVED";
  scheduledAt?: Date;
  createdBy: string;
}

export interface ITemplate extends Document<string> {
  _id: string;
  name: string;
  content: string; // HTML o JSON del builder
  active: boolean;
}

export interface IMetric extends Document<string> {
  _id: string;
  campaignId: string;
  sent: number;
  delivered: number;
  opens: number;
  uniqueOpens: number;
  clicks: number;
  uniqueClicks: number;
  bounces: number;
  complaints: number;
  unsubscribes: number;
}

export interface IEmailLog extends Document<string> {
  _id: string;
  campaignId: string;
  recipientId: string;
  to: string;
  event: string;
  timestamp: Date;
  meta?: any;
}

// Opción común para todos los esquemas de UUID
const schemaOptions = { 
  timestamps: true, 
  _id: false // Desactivamos el _id automático de Mongo para usar nuestro String
};

const CampaignSchema = new Schema<ICampaign>({
  _id: { type: String, default: () => randomUUID() },
  name: { type: String, required: true },
  subject: { type: String, required: true },
  templateId: { type: String, required: true, ref: 'Template' },
  segmentId: { type: String, required: true },
  status: { 
    type: String, 
    enum: ["DRAFT", "SCHEDULED", "SENDING", "SENT", "ARCHIVED"], 
    default: "DRAFT" 
  },
  scheduledAt: { type: Date },
  createdBy: { type: String, required: true },
}, schemaOptions);

const TemplateSchema = new Schema<ITemplate>({
  _id: { type: String, default: () => randomUUID() },
  name: { type: String, required: true },
  content: { type: String, required: true },
  active: { type: Boolean, default: true },
}, schemaOptions);

const MetricSchema = new Schema<IMetric>({
  _id: { type: String, default: () => randomUUID() },
  campaignId: { type: String, required: true, index: true },
  sent: { type: Number, default: 0 },
  delivered: { type: Number, default: 0 },
  opens: { type: Number, default: 0 },
  uniqueOpens: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  uniqueClicks: { type: Number, default: 0 },
  bounces: { type: Number, default: 0 },
  complaints: { type: Number, default: 0 },
  unsubscribes: { type: Number, default: 0 },
}, schemaOptions);

const EmailLogSchema = new Schema<IEmailLog>({
  _id: { type: String, default: () => randomUUID() },
  campaignId: { type: String, required: true, index: true },
  recipientId: { type: String, required: true },
  to: { type: String, required: true },
  event: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  meta: { type: Schema.Types.Mixed },
}, schemaOptions);

// --- MODELOS ---
export const CampaignModel = model<ICampaign>('Campaign', CampaignSchema);
export const TemplateModel = model<ITemplate>('Template', TemplateSchema);
export const MetricModel = model<IMetric>('Metric', MetricSchema);
export const EmailLogModel = model<IEmailLog>('EmailLog', EmailLogSchema);
// REPETIR PARA: SegmentModel, RecipientModel, FlightModel, NotificationModel, etc.
