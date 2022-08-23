const Poi = require('../models/poi');

module.exports.home_get = (req, res) => {
    res.render('home', { title: 'Home' });
}