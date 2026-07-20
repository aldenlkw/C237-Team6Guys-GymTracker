function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();

  req.flash('error', 'Please log in to continue.');
  return res.redirect('/login');
}

function isGuest(req, res, next) {
  if (!req.session || !req.session.user) return next();
  return res.redirect('/dashboard');
}

function isAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    req.flash('error', 'Please log in to continue.');
    return res.redirect('/login');
  }

  if (req.session.user.role !== 'admin') {
    return res.status(403).send('Forbidden: administrator access is required.');
  }

  return next();
}

module.exports = { isAuthenticated, isGuest, isAdmin };
