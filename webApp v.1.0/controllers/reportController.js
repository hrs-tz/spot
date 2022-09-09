const PositiveCase = require('../models/positive-case');

// handle errors
const handleErrors = (err) => {
    console.log(err.message);
    let errors = { user: '', date: '', testType: ''};

    // validation errors
    if (err.message.includes('PositiveCase validation failed')) {
        Object.values(err.errors).forEach(({properties}) => {
            errors[properties.path] = properties.message;
        });
    }

    return errors;
}

module.exports.report_get = (req, res) => {
    // get current date
    const today = new Date();
    let currentDate = new Date();
    // get current date (format: yyyy-mm-dd), slice to fill with zeros month and day
    currentDate = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
    res.render('report', { title: 'Report Positive Case', currentDate: currentDate });
};

module.exports.report_post = (req, res) => {

    const positiveCase = new PositiveCase({
        user: res.locals.user,
        date: req.body.date,
        testType: req.body.testType
    });

    positiveCase.save()
        .then((result) => {
            res.json({ result });
        })
        .catch((err) => {
            console.log(err);

            const errors = handleErrors(err);
            res.json({errors});
        })
};