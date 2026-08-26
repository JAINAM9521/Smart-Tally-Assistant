exports.profile = async (req, res) => res.json({ success: true, user: req.user });
exports.updateProfile = async (req, res, next) => { try { req.user.name = req.body.name ?? req.user.name; req.user.organization = req.body.organization ?? req.user.organization; await req.user.save(); res.json({ success: true, user: req.user }); } catch (e) { next(e); } };
