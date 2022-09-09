const User = require('../models/user');
const PositiveCase = require('../models/positive-case');
const Visit = require('../models/visit');
const Poi = require('../models/poi');
const NodeCache = require( "node-cache" );

const visitsCache = new NodeCache({ stdTTL: 30000 }); // 30sec default TTL
const casesCache = new NodeCache({ stdTTL: 30000 }); // 30sec default TTL

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
        // get user's visits and number of user's visits for pagination
        const visits = await Visit.find({ user: res.locals.user }).sort({ 'createdAt': -1 }).limit(20);
        let maxVisitsPage = await Visit.countDocuments({ user: res.locals.user });
        maxVisitsPage = Math.ceil(maxVisitsPage / 20);

        let pois = [];

        for (let visit of visits) {
            const poi = await Poi.findById(visit.poi);
            const visitPoi = {
                name: poi.name,
                address: poi.address,
                timestamp: (new Date(visit.createdAt)).toString().split('GMT')[0]
            };
            pois.push(visitPoi);   
        }

        // get user's positive test reports and number of user's positive test for pagination
        const positiveCases = await PositiveCase.find({user: res.locals.user}).sort({ 'date': -1 }).limit(20);
        let maxTestsPage = await PositiveCase.countDocuments({ user: res.locals.user });
        maxTestsPage = Math.ceil(maxTestsPage / 20);

        res.render('profile', { title: 'Profile', positiveCases: positiveCases, pois: pois, maxVisitsPage: maxVisitsPage, maxTestsPage: maxTestsPage });
    }
    catch (err) {
        console.log(err);
    }
};

module.exports.visitsPages_post = async (req, res) => {
    const pageCount = req.body.visitsPage;

    // every page has 20 results
    const visitsSkipped = 20 * pageCount;
    
    // form key for caching
    const keyPage = 'visits' + pageCount;

    // check cache
    if (visitsCache.has(keyPage)) {
        console.log('cache hit');
        res.status(200).json(visitsCache.get(keyPage));
    }
    else {
        console.log('cache miss');
        try {
            let pois = [];
            // get user's visits
            const visits = await Visit.find({ user: res.locals.user }).sort({ 'createdAt': -1 }).skip(visitsSkipped).limit(20);
        
            for (let visit of visits) {
                const poi = await Poi.findById(visit.poi);
                const visitPoi = {
                    name: poi.name,
                    address: poi.address,
                    timestamp: (new Date(visit.createdAt)).toString().split('GMT')[0]
                };
                pois.push(visitPoi);   
            }
    
            // add to cache with TTL 5min
            visitsCache.set(keyPage, { pois }, 300000);
            res.json({ pois });
        }
        catch (err) {
            console.log(err);
            const error = err.message
            res.send(error);
        }
    }
};

module.exports.positiveCasesPages_post = async (req, res) => {
    const pageCount = req.body.casesPage;

    // every page has 20 results
    const casesSkipped = 20 * pageCount;

    // form key for caching
    const keyPage = 'visits' + pageCount;

    // check cache
    if (casesCache.has(keyPage)) {
        console.log('cache hit');
        res.status(200).json(casesCache.get(keyPage));
    }
    else {
        console.log('cache miss');
        try {
            // get user's positive test reports
            const positiveCases = await PositiveCase.find({user: res.locals.user}).sort({ 'date': -1 }).skip(casesSkipped).limit(20);
    
            // add to cache with TTL 5min
            casesCache.set(keyPage, { positiveCases }, 300000);
            res.json({ positiveCases });
        }
        catch (err) {
            console.log(err);
            const error = err.message
            res.send(error);
        }
    }
};

module.exports.profile_post = async (req, res) => {

    const { username, oldPassword, password, permission } = req.body;
    const user = res.locals.user;

    try {
        const updatedUser = await User.updateProfile(user, oldPassword, username, password, permission);
        res.json({ user: updatedUser._id });
    } 
    catch (err) {
        const errors = handleErrors(err);
        res.json({errors});
    }

};