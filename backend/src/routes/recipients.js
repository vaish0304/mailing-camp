import { Router } from 'express';
import mongoose from 'mongoose';
import { Recipient } from '../db.js';

const router = Router();
const isId = (v) => mongoose.isValidObjectId(v);

// GET /api/recipients?search=&limit=&offset=
router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;

    let filter = {};
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter = { $or: [{ email: rx }, { first_name: rx }, { last_name: rx }, { company: rx }, { city: rx }] };
    }

    const [rows, total] = await Promise.all([
      Recipient.find(filter).sort({ created_at: -1 }).skip(offset).limit(limit).populate('groups', 'name'),
      Recipient.countDocuments(filter),
    ]);

    res.json({
      recipients: rows.map((r) => {
        const json = r.toJSON();
        json.groups = (r.groups || []).map((g) => g.name);
        return json;
      }),
      total,
    });
  } catch (e) { next(e); }
});

// PATCH /api/recipients/:id
router.patch('/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const allowed = ['first_name', 'last_name', 'company', 'phone', 'city', 'unsubscribed'];
    const patch = {};
    for (const k of allowed) {
      if (req.body?.[k] !== undefined) {
        patch[k] = k === 'unsubscribed' ? Boolean(req.body[k]) : (String(req.body[k]).trim() || null);
      }
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
    const r = await Recipient.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!r) return res.status(404).json({ error: 'not found' });
    res.json(r.toJSON());
  } catch (e) { next(e); }
});

// DELETE /api/recipients/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const r = await Recipient.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
