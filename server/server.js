import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { setServers } from 'node:dns';
import routes from './routes.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) { console.error('JWT_SECRET must be set to a random value of at least 32 characters.'); process.exit(1); }
if (!process.env.MONGODB_URI) { console.error('MONGODB_URI must be configured before starting the server.'); process.exit(1); }
// Development-only workaround for networks that block Node's default SRV DNS lookups.
// NODE_ENV is often unset in local development; production is always left unchanged.
if (process.env.NODE_ENV !== 'production') {
  setServers(['8.8.8.8']);
  console.log('Development DNS resolver override enabled for Atlas SRV lookups.');
}
const app = express();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many authentication attempts. Please try again in 15 minutes.' } });
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authLimiter);
app.use('/api', routes);
app.use((err, req, res, next) => { console.error(err); if (err.status) return res.status(err.status).json({ message: err.message }); if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(', ') }); if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid record ID.' }); res.status(500).json({ message: 'Something went wrong on the server.' }); });
const port = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI).then(() => app.listen(port, () => console.log(`CRM API listening on port ${port}`))).catch((error) => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
