const User = require('../models/user');
const PositiveCase = require('../models/positive-case');
const Visit = require('../models/visit');
const Poi = require('../models/poi');

// handle errors
const handleErrors = (err) => {
    console.log(err.message, err.code);
    let errors = { username: '', oldPassword: '', password: ''};

    // incorrect password
    if (err.message === 'incorrect password') {
        errors.oldPassword = 'that password is incorrect. Try again...'
    }

    // duplicate error code
    if (err.code === 11000) {
        errors.username = 'this username is already registered'
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

module.exports.profile_get = async (req, res) => {
    try {
        // get user's visits
        const visits = await Visit.find({ user: res.locals.user }).sort({ 'createdAt': -1 });
        let pois = [];
        visits.forEach(async (visit) =>{
            const poi = await Poi.findById(visit.poi);
            const visitPoi = {
            name: poi.name,
            address: poi.address,
            timestamp: visit.createdAt
            };
            pois.push(visitPoi);          
        });

        // get user's positive test reports
        const positiveCases = await PositiveCase.find({user: res.locals.user}).sort({ 'date': -1 });
        res.render('profile', { title: 'Profile', positiveCases: positiveCases, pois: pois });
    }
    catch (err) {
        console.log(err);
    }
};

module.exports.profile_post = async (req, res) => {

    const { username, oldPassword, password } = req.body;
    const user = res.locals.user;

    try {
        const updatedUser = await User.updateProfile(user, oldPassword, username, password);
        res.json({ user: updatedUser._id });
    } 
    catch (err) {
        const errors = handleErrors(err);
        res.json({errors});
    }

};