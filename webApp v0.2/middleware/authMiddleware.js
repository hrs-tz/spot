const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');
const User = require('../models/user');

// function to make routes for users only
const requireAuth = (req, res, next) => {

    // get jwt
    const token = req.cookies.jwt;

    // check if jwt exists and is verified
    if (token) {
        jwt.verify(token, 'Web Project 2022 secret key!', (err, decodedToken) => {
            if (err) {
                console.log(err);
                res.redirect('/login');
            }
            else {
                // continue to next middleware
                next();
            }
        });
    }
    // token is empty - redirect to login page
    else {
        res.redirect('/login');
    }
}

// function to make routes for admin only
const requireAdminAuth = (req, res, next) => {

    const token = req.cookies.jwt;

    // check if jwt exists and is verified
    if (token) {
        jwt.verify(token, 'Web Project 2022 secret key for admin!', (err, decodedToken) => {
            if (err) {
                console.log(err);
                res.redirect('/access-denied');
            }
            else {
                // continue to next middleware
                next();
            }
        });
    }
    else {
        res.redirect('/access-denied');
    }
}

// check current admin / user
const checkUser = (req, res, next) => {

    // get jwt
    const token = req.cookies.jwt;

    if (token) {
        // first check for admin token
        jwt.verify(token, 'Web Project 2022 secret key for admin!', async (err, decodedToken) => {
            // not an admin token
            if (err) {
                // set local variable 'admin' to null
                res.locals.admin = null;
                // then, check for user token
                jwt.verify(token, 'Web Project 2022 secret key!', async (err, decodedToken) => {
                    // not a user token
                    if (err) {
                        console.log(err.message);
                        // set local variable 'user' to null
                        res.locals.user = null;
                        // continue to next middleware
                        next();
                    }
                    // user token
                    else {
                        // get user from db
                        let user = await User.findById(decodedToken.id);
                        // set local variable 'user'
                        res.locals.user = user;
                        // continue to next middleware
                        next();
                    }
                });
            }
            // admin token
            else {
                // get admin from db
                let admin = await Admin.findById(decodedToken.id);
                // set local variable 'admin'
                res.locals.admin = admin;
                // set local variable 'user' to null
                res.locals.user = null;
                // continue to next middleware
                next();
            }
        })
    }
    // token is empty - no token
    else {
        // set local variable 'user' to null
        res.locals.admin = null;
        // set local variable 'user' to null
        res.locals.user = null;
        // continue to next middleware
        next();
    }

}

module.exports = { requireAuth, requireAdminAuth, checkUser };