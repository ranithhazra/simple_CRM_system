import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { Customer, Deal, FollowUp, User } from '../models.js';
import { HttpError, ensureCustomerCanBeDeleted, isValidObjectId, protect, validateCustomerOwnership } from '../routes.js';

process.env.JWT_SECRET = 'test_secret_that_is_long_enough_for_static_checks';
const validId = '507f1f77bcf86cd799439011';

test('invalid ObjectIds are rejected before database access', () => {
  assert.equal(isValidObjectId('not-an-id'), false);
  assert.equal(isValidObjectId(validId), true);
});

test('customer ownership validation rejects an invalid customer ID', async () => {
  await assert.rejects(() => validateCustomerOwnership('not-an-id', validId), (error) => error instanceof HttpError && error.status === 400);
});

test('customer ownership validation blocks a customer from another account', async () => {
  const original = Customer.findOne;
  Customer.findOne = () => ({ select: async () => null });
  try {
    await assert.rejects(() => validateCustomerOwnership(validId, validId), (error) => error instanceof HttpError && error.status === 403);
  } finally { Customer.findOne = original; }
});

test('customer deletion is blocked when related records exist', async () => {
  const originalDeals = Deal.countDocuments; const originalFollowUps = FollowUp.countDocuments;
  Deal.countDocuments = async () => 1; FollowUp.countDocuments = async () => 0;
  try {
    await assert.rejects(() => ensureCustomerCanBeDeleted(validId, validId), (error) => error instanceof HttpError && error.status === 409 && error.message.includes('1 deal'));
  } finally { Deal.countDocuments = originalDeals; FollowUp.countDocuments = originalFollowUps; }
});

test('protected middleware accepts a valid JWT for an existing user', async () => {
  const original = User.findById;
  User.findById = async () => ({ _id: validId, name: 'Test User' });
  const req = { cookies: { token: jwt.sign({ id: validId }, process.env.JWT_SECRET) }, headers: {} };
  let nextCalled = false;
  try {
    await protect(req, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.name, 'Test User');
  } finally { User.findById = original; }
});

test('protected middleware passes a 401 error for missing authentication', async () => {
  let error;
  await protect({ cookies: {}, headers: {} }, {}, (nextError) => { error = nextError; });
  assert.equal(error.status, 401);
});
