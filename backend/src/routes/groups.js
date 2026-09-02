import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { Group, Recipient } from '../db.js';
import { parseRecipientsFile, FIELDS } from '../parse.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const isId = (v) => mongoose.isValidObjectId(v);

async function withCounts(groups) {
  const counts = await Promise.all(
    groups.map((g) => Recipient.countDocuments({ groups: g._id })),
  );
  return groups.map((g, i) => ({ ...g.toJSON(), recipient_count: counts[i] }));
}

// GET /api/groups
router.get('/', async (_req, res, next) => {
  try {
    const groups = await Group.find().sort({ created_at: -1 });
    res.json(await withCounts(groups));
  } catch (e) { next(e); }
});

// POST /api/groups  { name, description? }
router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    const exists = await Group.findOne({ name });
    if (exists) return res.status(409).json({ error: 'A group with that name already exists' });
    const g = await Group.create({ name, description: String(req.body?.description || '').trim() || null });
    res.status(201).json({ ...g.toJSON(), recipient_count: 0 });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'A group with that name already exists' });
    next(e);
  }
});

// PATCH /api/groups/:id
router.patch('/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const patch = {};
    if (req.body?.name !== undefined) patch.name = String(req.body.name).trim();
    if (req.body?.description !== undefined) patch.description = String(req.body.description).trim() || null;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
    const g = await Group.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!g) return res.status(404).json({ error: 'not found' });
    res.json(g.toJSON());
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'A group with that name already exists' });
    next(e);
  }
});

// DELETE /api/groups/:id  (recipients themselves are kept, just detached)
router.delete('/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const g = await Group.findByIdAndDelete(req.params.id);
    if (!g) return res.status(404).json({ error: 'not found' });
    await Recipient.updateMany({ groups: g._id }, { $pull: { groups: g._id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// GET /api/groups/:id/recipients
router.get('/:id/recipients', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const rows = await Recipient.find({ groups: req.params.id }).sort({ email: 1 });
    res.json(rows.map((r) => r.toJSON()));
  } catch (e) { next(e); }
});

// POST /api/groups/:id/import   multipart form-data, field "file"
router.post('/:id/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'group not found' });
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'group not found' });
    if (!req.file) return res.status(400).json({ error: 'no file uploaded (field name must be "file")' });

    const { recipients, errors, unmappedHeaders } = parseRecipientsFile(req.file.buffer, req.file.originalname);
    if (!recipients.length) {
      return res.status(422).json({
        error: 'No valid rows found. Expected a header row with at least an "email" column.',
        expectedColumns: FIELDS,
        errors,
        unmappedHeaders,
      });
    }

    let inserted = 0;
    let updated = 0;
    let addedToGroup = 0;

    for (const r of recipients) {
      const set = {};
      for (const f of ['first_name', 'last_name', 'company', 'phone', 'city']) {
        if (r[f]) set[f] = r[f];
      }

      const result = await Recipient.findOneAndUpdate(
        { email: r.email },
        { $set: set, $addToSet: { groups: group._id } },
        { upsert: true, new: false, includeResultMetadata: true },
      );

      const existedBefore = result.lastErrorObject?.updatedExisting;
      if (existedBefore) {
        updated++;
        const had = (result.value?.groups || []).some((g) => String(g) === String(group._id));
        if (!had) addedToGroup++;
      } else {
        inserted++;
        addedToGroup++;
      }
    }

    res.json({
      groupId: String(group._id),
      parsed: recipients.length,
      inserted,
      updated,
      addedToGroup,
      alreadyInGroup: recipients.length - addedToGroup,
      rowErrors: errors,
      unmappedHeaders,
    });
  } catch (e) { next(e); }
});

// POST /api/groups/:id/recipients  { email, first_name, last_name, company, phone, city }
// Manually add one recipient (upsert by email) and attach to the group.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
router.post('/:id/recipients', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'group not found' });
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'group not found' });

    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'a valid email is required' });

    const set = {};
    for (const f of ['first_name', 'last_name', 'company', 'phone', 'city']) {
      const v = String(req.body?.[f] ?? '').trim();
      if (v) set[f] = v;
    }

    const before = await Recipient.findOne({ email }).lean();
    const r = await Recipient.findOneAndUpdate(
      { email },
      { $set: set, $addToSet: { groups: group._id } },
      { upsert: true, new: true },
    );

    const created = !before;
    const addedToGroup = created || !(before.groups || []).some((g) => String(g) === String(group._id));
    res.status(created ? 201 : 200).json({ recipient: r.toJSON(), created, addedToGroup });
  } catch (e) { next(e); }
});

// POST /api/groups/:id/members  { recipientIds: [] }
router.post('/:id/members', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const ids = (req.body?.recipientIds || []).filter(isId);
    if (!ids.length) return res.status(400).json({ error: 'recipientIds required' });
    await Recipient.updateMany({ _id: { $in: ids } }, { $addToSet: { groups: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /api/groups/:id/members/:recipientId — remove from group only
router.delete('/:id/members/:recipientId', async (req, res, next) => {
  try {
    if (!isId(req.params.id) || !isId(req.params.recipientId)) return res.status(404).json({ error: 'not found' });
    const r = await Recipient.updateOne(
      { _id: req.params.recipientId },
      { $pull: { groups: req.params.id } },
    );
    if (!r.matchedCount) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
