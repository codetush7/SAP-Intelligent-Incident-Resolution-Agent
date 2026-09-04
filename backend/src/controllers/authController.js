const Joi = require('joi');
const userStore = require('../utils/userStore');
const { signToken } = require('../middleware/authMiddleware');

const signupSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    .messages({ 'any.only': 'Passwords do not match' })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

async function signup(req, res) {
  const { error, value } = signupSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const user = await userStore.create(value);
    const token = signToken(user);
    res.status(201).json({ token, user: userStore.toPublic(user) });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
}

async function login(req, res) {
  const { error, value } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const user = userStore.findByEmail(value.email);
  if (!user || !(await userStore.verifyPassword(user, value.password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user);
  res.json({ token, user: userStore.toPublic(user) });
}

function getMe(req, res) {
  res.json({ user: req.user });
}

module.exports = { signup, login, getMe };
