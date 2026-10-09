import { Router } from 'express';
import mongoose from 'mongoose';
import { Campaign, Group, Project } from '../db.js';

const router = Router();
const isId = (value) => mongoose.isValidObjectId(value);

async function defaultProject() {
  return Project.findOneAndUpdate(
    { is_default: true },
    { $setOnInsert: { name: 'AI Sales Assistant', description: 'Primary mailing workspace', is_default: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function migrateLegacyGroups(project) {
  await Group.updateMany({ project_id: null }, { $set: { project_id: project._id } });
  await Campaign.updateMany({ project_id: null }, { $set: { project_id: project._id } });
}

router.get('/', async (_req, res, next) => {
  try {
    const primary = await defaultProject();
    await migrateLegacyGroups(primary);
    const projects = await Project.find().sort({ is_default: -1, created_at: 1 });
    const counts = await Promise.all(projects.map((project) => Group.countDocuments({ project_id: project._id })));
    res.json(projects.map((project, index) => ({ ...project.toJSON(), group_count: counts[index] })));
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'project name is required' });
    const project = await Project.create({
      name,
      description: String(req.body?.description || '').trim() || null,
      color: /^#[0-9a-f]{6}$/i.test(req.body?.color || '') ? req.body.color : '#165943',
    });
    res.status(201).json({ ...project.toJSON(), group_count: 0 });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'A project with that name already exists' });
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const patch = {};
    if (req.body?.name !== undefined) patch.name = String(req.body.name).trim();
    if (req.body?.description !== undefined) patch.description = String(req.body.description).trim() || null;
    if (/^#[0-9a-f]{6}$/i.test(req.body?.color || '')) patch.color = req.body.color;
    const project = await Project.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!project) return res.status(404).json({ error: 'not found' });
    res.json(project.toJSON());
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'not found' });
    if (project.is_default) return res.status(400).json({ error: 'The primary project cannot be deleted' });
    const groupCount = await Group.countDocuments({ project_id: project._id });
    if (groupCount) return res.status(409).json({ error: 'Move or delete this project’s groups before deleting it' });
    await project.deleteOne();
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
