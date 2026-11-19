import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Customer, Deal, FollowUp, Lead, User } from './models.js';

const router = express.Router();
const CUSTOMER_FIELDS = ['name', 'email', 'phone', 'company', 'address', 'notes'];
const LEAD_FIELDS = ['name', 'email', 'phone', 'company', 'status', 'notes'];
const DEAL_FIELDS = ['title', 'customer', 'amount', 'status', 'expectedCloseDate'];
const FOLLOW_UP_FIELDS = ['customer', 'date', 'time', 'description', 'status'];
const LEAD_STATUSES = ['New', 'Contacted', 'Interested', 'Converted', 'Lost'];
const DEAL_STATUSES = ['Pending', 'Won', 'Lost'];
const FOLLOW_UP_STATUSES = ['Pending', 'Completed'];

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const isValidObjectId = (id) => typeof id === 'string' && mongoose.isValidObjectId(id);
export const isEmail = (value) => /^\S+@\S+\.\S+$/.test(value);
const isValidDate = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email });
const jwtSecret = () => process.env.JWT_SECRET;
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
const clean = (body, keys) => Object.fromEntries(keys.filter((key) => body[key] !== undefined).map((key) => [key, typeof body[key] === 'string' ? body[key].trim() : body[key]]));
const required = (value, label) => { if (value === undefined || value === null || value === '') throw new HttpError(400, `${label} is required.`); };
const optionalEmail = (email) => { if (email && !isEmail(email)) throw new HttpError(400, 'Please enter a valid email address.'); };
const statusIn = (status, valid, label) => { if (status !== undefined && !valid.includes(status)) throw new HttpError(400, `Invalid ${label} status.`); };

export const protect = asyncRoute(async (req, res, next) => {
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  const token = req.cookies?.token || bearer;
  if (!token) throw new HttpError(401, 'Please log in to continue.');
  try {
    const decoded = jwt.verify(token, jwtSecret());
    const user = await User.findById(decoded.id);
    if (!user) throw new HttpError(401, 'Account no longer exists.');
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, 'Your session has expired. Please log in again.');
  }
});

export const validateCustomerOwnership = async (customerId, ownerId) => {
  if (!isValidObjectId(customerId)) throw new HttpError(400, 'Please select a valid customer.');
  const customer = await Customer.findOne({ _id: customerId, owner: ownerId }).select('_id');
  if (!customer) throw new HttpError(403, 'You cannot use a customer that does not belong to your account.');
  return customer;
};

export const ensureCustomerCanBeDeleted = async (customerId) => {
  const [dealCount, followUpCount] = await Promise.all([Deal.countDocuments({ customer: customerId }), FollowUp.countDocuments({ customer: customerId })]);
  if (dealCount || followUpCount) {
    const related = [dealCount && `${dealCount} deal${dealCount === 1 ? '' : 's'}`, followUpCount && `${followUpCount} follow-up${followUpCount === 1 ? '' : 's'}`].filter(Boolean).join(' and ');
    throw new HttpError(409, `This customer cannot be deleted because it has ${related}. Remove or reassign those records first.`);
  }
};

const validateCustomer = (value, creating) => { if (creating) required(value.name, 'Customer name'); if (value.name !== undefined && !value.name) throw new HttpError(400, 'Customer name cannot be empty.'); optionalEmail(value.email); };
const validateLead = (value, creating) => { if (creating) required(value.name, 'Lead name'); if (value.name !== undefined && !value.name) throw new HttpError(400, 'Lead name cannot be empty.'); optionalEmail(value.email); statusIn(value.status, LEAD_STATUSES, 'lead'); };
const validateDeal = async (value, creating, ownerId) => {
  if (creating) ['title', 'customer', 'amount', 'expectedCloseDate'].forEach((key) => required(value[key], key === 'expectedCloseDate' ? 'Expected closing date' : key[0].toUpperCase() + key.slice(1)));
  if (value.title !== undefined && !value.title) throw new HttpError(400, 'Deal title cannot be empty.');
  if (value.amount !== undefined && (typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount < 0)) throw new HttpError(400, 'Deal amount must be a non-negative number.');
  if (value.expectedCloseDate !== undefined && !isValidDate(value.expectedCloseDate)) throw new HttpError(400, 'Please provide a valid expected closing date.');
  statusIn(value.status, DEAL_STATUSES, 'deal'); if (value.customer !== undefined) await validateCustomerOwnership(value.customer, ownerId);
};
const validateFollowUp = async (value, creating, ownerId) => {
  if (creating) ['customer', 'date', 'time', 'description'].forEach((key) => required(value[key], key === 'customer' ? 'Customer' : key[0].toUpperCase() + key.slice(1)));
  if (value.date !== undefined && !isValidDate(value.date)) throw new HttpError(400, 'Please provide a valid follow-up date.');
  if (value.time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) throw new HttpError(400, 'Please provide a valid follow-up time.');
  if (value.description !== undefined && !value.description) throw new HttpError(400, 'Follow-up description cannot be empty.');
  statusIn(value.status, FOLLOW_UP_STATUSES, 'follow-up'); if (value.customer !== undefined) await validateCustomerOwnership(value.customer, ownerId);
};

router.post('/auth/register', asyncRoute(async (req, res) => {
  const { name, email, password } = req.body;
  required(name?.trim(), 'Name'); required(email?.trim(), 'Email'); required(password, 'Password');
  if (!isEmail(email)) throw new HttpError(400, 'Please enter a valid email address.');
  if (password.length < 6) throw new HttpError(400, 'Password must contain at least 6 characters.');
  if (await User.findOne({ email: email.toLowerCase() })) throw new HttpError(409, 'An account with this email already exists.');
  const user = await User.create({ name, email, password: await bcrypt.hash(password, 12) });
  const token = jwt.sign({ id: user._id, name: user.name }, jwtSecret(), { expiresIn: '7d' });
  res.cookie('token', token, cookieOptions()).status(201).json({ user: publicUser(user) });
}));
router.post('/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body;
  required(email?.trim(), 'Email'); required(password, 'Password');
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await bcrypt.compare(password, user.password))) throw new HttpError(401, 'Invalid email or password.');
  const token = jwt.sign({ id: user._id, name: user.name }, jwtSecret(), { expiresIn: '7d' });
  res.cookie('token', token, cookieOptions()).json({ user: publicUser(user) });
}));
router.post('/auth/logout', (req, res) => res.clearCookie('token', { ...cookieOptions(), maxAge: undefined }).json({ message: 'Logged out.' }));
router.get('/auth/me', protect, (req, res) => res.json({ user: publicUser(req.user) }));

const registerCrud = ({ path, Model, fields, validate, populate = '', beforeDelete }) => {
  router.get(path, protect, asyncRoute(async (req, res) => { const filter = { owner: req.user._id }; if (req.query.search) filter.$or = ['name', 'email', 'company', 'title', 'description'].map((field) => ({ [field]: { $regex: req.query.search, $options: 'i' } })); let query = Model.find(filter); if (populate) query = query.populate(populate); res.json(await query.sort({ createdAt: -1 })); }));
  router.post(path, protect, asyncRoute(async (req, res) => { const value = clean(req.body, fields); await validate(value, true, req.user._id); const doc = await Model.create({ ...value, owner: req.user._id }); res.status(201).json(populate ? await doc.populate(populate) : doc); }));
  router.put(`${path}/:id`, protect, asyncRoute(async (req, res) => { if (!isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid record ID.'); const value = clean(req.body, fields); await validate(value, false, req.user._id); let query = Model.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, value, { new: true, runValidators: true }); if (populate) query = query.populate(populate); const doc = await query; if (!doc) throw new HttpError(404, 'Record not found.'); res.json(doc); }));
  router.delete(`${path}/:id`, protect, asyncRoute(async (req, res) => { if (!isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid record ID.'); const record = await Model.findOne({ _id: req.params.id, owner: req.user._id }); if (!record) throw new HttpError(404, 'Record not found.'); if (beforeDelete) await beforeDelete(record, req.user._id); await record.deleteOne(); res.json({ message: 'Record deleted.' }); }));
};
registerCrud({ path: '/customers', Model: Customer, fields: CUSTOMER_FIELDS, validate: validateCustomer, beforeDelete: (customer) => ensureCustomerCanBeDeleted(customer._id) });
registerCrud({ path: '/leads', Model: Lead, fields: LEAD_FIELDS, validate: validateLead });
registerCrud({ path: '/deals', Model: Deal, fields: DEAL_FIELDS, validate: validateDeal, populate: 'customer' });
registerCrud({ path: '/follow-ups', Model: FollowUp, fields: FOLLOW_UP_FIELDS, validate: validateFollowUp, populate: 'customer' });

router.get('/dashboard', protect, asyncRoute(async (req, res) => {
  const owner = req.user._id;
  const [customers, leads, deals, revenue, pendingFollowUps, recentCustomers, recentDeals, recentFollowUps, pipeline] = await Promise.all([Customer.countDocuments({ owner }), Lead.countDocuments({ owner }), Deal.countDocuments({ owner }), Deal.aggregate([{ $match: { owner, status: 'Won' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]), FollowUp.countDocuments({ owner, status: 'Pending' }), Customer.find({ owner }).sort({ createdAt: -1 }).limit(5), Deal.find({ owner }).populate('customer', 'name').sort({ updatedAt: -1 }).limit(5), FollowUp.find({ owner, status: 'Pending' }).populate('customer', 'name').sort({ date: 1 }).limit(5), Deal.aggregate([{ $match: { owner } }, { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } }])]);
  const activities = [...recentCustomers.map((item) => ({ id: item._id, label: `Added customer ${item.name}`, date: item.createdAt, type: 'customer' })), ...recentDeals.map((item) => ({ id: item._id, label: `${item.status} deal: ${item.title}`, date: item.updatedAt, type: 'deal' })), ...recentFollowUps.map((item) => ({ id: item._id, label: `Follow-up for ${item.customer?.name || 'customer'}`, date: item.updatedAt, type: 'followup' }))].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  res.json({ stats: { customers, leads, deals, revenue: revenue[0]?.total || 0, pendingFollowUps }, recentCustomers, recentDeals, recentFollowUps, pipeline, activities });
}));
export default router;
