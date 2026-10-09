import mongoose from 'mongoose';

if (!process.env.MONGODB_URI) {
  console.error('FATAL: MONGODB_URI is not set');
  process.exit(1);
}

mongoose.set('strictQuery', true);

// --- shared toJSON transform: expose `id`, drop `_id` / `__v` ---
const toJSON = {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id?.toString?.() ?? ret._id;
    delete ret._id;
    return ret;
  },
};

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: null },
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, toJSON },
);

const recipientSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    first_name: { type: String, default: null },
    last_name: { type: String, default: null },
    company: { type: String, default: null },
    phone: { type: String, default: null },
    city: { type: String, default: null },
    custom_fields: { type: Map, of: String, default: {} },
    unsubscribed: { type: Boolean, default: false },
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group', index: true }],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, toJSON },
);

const campaignSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    html: { type: String, required: true },
    from_email: { type: String, required: true },
    reply_to: { type: String, default: null },
    group_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    status: { type: String, default: 'draft' }, // draft | sending | sent | partial | failed
    total_recipients: { type: Number, default: 0 },
    audience_count: { type: Number, default: 0 },
    deferred_count: { type: Number, default: 0 },
    sent_count: { type: Number, default: 0 },
    failed_count: { type: Number, default: 0 },
    error: { type: String, default: null },
    sent_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, toJSON },
);

const campaignSendSchema = new mongoose.Schema(
  {
    campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipient', default: null },
    email: { type: String, required: true },
    resend_id: { type: String, default: null, index: true },
    status: { type: String, default: 'pending' }, // pending | sent | delivered | opened | clicked | delayed | bounced | complained | failed
    error: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, toJSON },
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: null },
    color: { type: String, default: '#165943' },
    is_default: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, toJSON },
);

export const Project = mongoose.model('Project', projectSchema);
export const Group = mongoose.model('Group', groupSchema);
export const Recipient = mongoose.model('Recipient', recipientSchema);
export const Campaign = mongoose.model('Campaign', campaignSchema);
export const CampaignSend = mongoose.model('CampaignSend', campaignSendSchema);

export async function initDb() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  await Promise.all([
    Project.syncIndexes(),
    Group.syncIndexes(),
    Recipient.syncIndexes(),
    Campaign.syncIndexes(),
    CampaignSend.syncIndexes(),
  ]);
  console.log('MongoDB connected');
}

export async function pingDb() {
  return mongoose.connection.db.admin().ping();
}

export { mongoose };
