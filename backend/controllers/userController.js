"use strict";

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  organization: user.organization,
  role: user.role,
  isEmailVerified: user.isEmailVerified,
});

exports.profile = async (req, res) =>
  res.json({ success: true, user: publicUser(req.user) });

exports.updateProfile = async (req, res, next) => {
  try {
    req.user.name = req.body.name ?? req.user.name;
    req.user.organization = req.body.organization ?? req.user.organization;
    await req.user.save();
    res.json({ success: true, user: publicUser(req.user) });
  } catch (error) {
    next(error);
  }
};
