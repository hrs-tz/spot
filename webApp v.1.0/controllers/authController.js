const User = require('../models/user');
const Admin = require('../models/admin');
const jwt = require('jsonwebtoken');

// handle errors
const handleErrors = (err) => {
    console.log(err.message, err.code);
    let errors = { username: '', password: '', email: ''};

    // incorrect email
    if (err.message === 'incorrect email') {
        errors.email = 'that email is not registered. Try again...';
    }

    // incorrect password
    if (err.message === 'incorrect password') {
        errors.password = 'that password is incorrect. Try again...'
    }

    // incorrect username
    if (err.message === 'incorrect username') {
        errors.username = 'that username is incorrect. Try again...';
    }

    // duplicate error code
    if (err.code === 11000) {
        Object.keys(err.keyPattern).forEach((key) => {
            errors[key] = `this ${key} is already registered`;
        });
        
        return errors;
    }

    // validation errors
    if (err.message.includes('User validation failed')) {
        Object.values(err.errors).forEach(({properties}) => {
            errors[properties.path] = properties.message;
        });
    }

    return errors;
}

const maxAge = 1 * 24 * 60 * 60; // validity duration: 1 day

// create jwt for user
const createToken = (id) => {
    return jwt.sign({ id }, 'Web Project 2022 secret key!', {
        expiresIn: maxAge
    });
}

// create jwt for admin
const createTokenAdmin = (id) => {
    return jwt.sign({ id }, 'Web Project 2022 secret key for admin!', {
        expiresIn: maxAge
    });
}

module.exports.signup_get = (req, res) => {
    res.render('signup', { title: 'Sign Up '});
};

module.exports.login_get = (req, res) => {
    if (!res.locals.user) {
        res.render('login', { title: 'Log In '});
    }
    else {
        res.redirect('/home');
    }
};

module.exports.loginAdmin_get = (req, res) => {
    if (!res.locals.admin) {
        res.render('loginAdmin', { title: 'Log In '});
    }
    else {
        res.redirect('/dashboard');
    }
};

module.exports.signup_post = (req, res) => {
    const { username, password, email } = req.body;
    
    const user = new User({
        username: username,
        password: password,
        email: email
    });

    user.save()
        .then((result) => {
            const token = createToken(result._id);
            res.cookie('jwt', token, { httpOnly: true, maxAge: maxAge * 1000 });
            res.json({ user: result._id });
        })
        .catch((err) => {
            const errors = handleErrors(err);
            res.json({errors});
        });
};

module.exports.login_post = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.login(email, password);
        const token = createToken(user._id);
        res.cookie('jwt', token, { httpOnly: true, maxAge: maxAge * 1000 });
        res.status(200).json({ user: user._id } );
    } 
    catch (err) {
        const errors = handleErrors(err);
        res.json({errors});
    }
};

module.exports.loginAdmin_post = async (req, res) => {
    const { username, password } = req.body;

    try {
        const admin = await Admin.login(username, password);
        const token = createTokenAdmin(admin._id);
        res.cookie('jwt', token, { httpOnly: true, maxAge: maxAge * 1000 });
        res.status(200).json({ admin: admin._id } );
    } 
    catch (err) {
        const errors = handleErrors(err);
        res.json({errors});
    }
};

module.exports.logout_get = (req, res) => {
    res.cookie('jwt', '', { maxAge: 1 });
    res.redirect('/login');
};