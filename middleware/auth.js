// Blocks any page that requires a logged-in user.
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    req.flash('error', 'Please log in to view that page.');
    res.redirect('/login');
};

// Blocks any page that requires the admin role (RBAC).
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.flash('error', 'You do not have permission to access that page.');
    res.redirect('/dashboard');
};

module.exports = { checkAuthenticated, checkAdmin };