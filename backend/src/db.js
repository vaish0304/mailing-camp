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
    progress_reset_at: { type: Date, default: null },
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
    unsubscribed_at: { type: Date, default: null },
    unsubscribe_source: { type: String, default: null },
    whatsapp_opt_in: { type: Boolean, default: false, index: true },
    whatsapp_opted_in_at: { type: Date, default: null },
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
    experiment_id: { type: String, default: null, index: true },
    variant_id: { type: String, default: null },
    variant_name: { type: String, default: null },
    status: { type: String, default: 'draft' }, // draft | sending | sent | partial | failed
    total_recipients: { type: Number, default: 0 },
    audience_count: { type: Number, default: 0 },
    deferred_count: { type: Number, default: 0 },
    sent_count: { type: Number, default: 0 },
    failed_count: { type: Number, default: 0 },
    error: { type: String, default: null },
    last_event_at: { type: Date, default: null },
    delivered_at: { type: Date, default: null },
    opened_at: { type: Date, default: null },
    clicked_at: { type: Date, default: null },
    sent_at: { type: Date, default: null },
    attach_brochure: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, toJSON },
);

const trackedLinkSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    destination_url: { type: String, required: true },
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    click_count: { type: Number, default: 0 },
    unique_click_count: { type: Number, default: 0 },
    last_clicked_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, toJSON },
);

const linkClickSchema = new mongoose.Schema(
  {
    tracked_link_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TrackedLink', required: true, index: true },
    campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null, index: true },
    campaign_send_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CampaignSend', default: null, index: true },
    fingerprint: { type: String, default: null, index: true },
    user_agent: { type: String, default: null },
    referer: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, toJSON },
);

const unsubscribeEventSchema = new mongoose.Schema(
  {
    recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipient', default: null, index: true },
    campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    source: { type: String, default: 'email_link' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, toJSON },
);

const webhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, default: 'resend' },
    provider_event_id: { type: String, default: null, unique: true, sparse: true },
    event_type: { type: String, required: true, index: true },
    email_id: { type: String, default: null, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    processed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, toJSON },
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

const whatsappCampaignSchema = new mongoose.Schema(
  {
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    group_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    template_name: { type: String, required: true },
    language_code: { type: String, required: true },
    body_values: [{ type: String }],
    status: { type: String, default: 'draft' },
    total_recipients: { type: Number, default: 0 },
    sent_count: { type: Number, default: 0 },
    failed_count: { type: Number, default: 0 },
    error: { type: String, default: null },
    sent_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, toJSON },
);

const whatsappSendSchema = new mongoose.Schema(
  {
    campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppCampaign', required: true, index: true },
    recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipient', required: true, index: true },
    phone: { type: String, required: true },
    message_id: { type: String, default: null, index: true },
    status: { type: String, default: 'pending' },
    error: { type: String, default: null },
    last_event_at: { type: Date, default: null },
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
export const TrackedLink = mongoose.model('TrackedLink', trackedLinkSchema);
export const LinkClick = mongoose.model('LinkClick', linkClickSchema);
export const UnsubscribeEvent = mongoose.model('UnsubscribeEvent', unsubscribeEventSchema);
export const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
export const WhatsAppCampaign = mongoose.model('WhatsAppCampaign', whatsappCampaignSchema);
export const WhatsAppSend = mongoose.model('WhatsAppSend', whatsappSendSchema);

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
    TrackedLink.syncIndexes(),
    LinkClick.syncIndexes(),
    UnsubscribeEvent.syncIndexes(),
    WebhookEvent.syncIndexes(),
    WhatsAppCampaign.syncIndexes(),
    WhatsAppSend.syncIndexes(),
  ]);
  console.log('MongoDB connected');
}

export async function pingDb() {
  return mongoose.connection.db.admin().ping();
}

export { mongoose };
