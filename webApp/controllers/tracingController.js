const PositiveCase = require('../models/positive-case');
const Visit = require('../models/visit');
const Poi = require('../models/poi');
const mongoose = require('mongoose');

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

module.exports.tracing_get = async (req, res) => {
    // variables for getting user's visits for the last 7 days
    const currentDate = new Date();
    const aWeekEarlier = new Date();
    aWeekEarlier.setDate(currentDate.getDate() - 7);
    
    // get user's visits for the last 7 days
    const userVisits = await Visit.find({$and: [ 
        { createdAt: { $gte: aWeekEarlier, $lte: currentDate } },
        { user: res.locals.user } 
    ] });

    // get other users' visits and their positive reports history
    const visits = await Visit.aggregate([ 
        { $match: { user: { $ne: mongoose.Types.ObjectId(res.locals.user) } } },
        { $lookup:
            {
                from: 'positivecases',
                localField: 'user',
                foreignField: 'user',
                as: 'positiveCases'
            }
        } 
    ]);

    // array to store pois where user might have contacted a positive case
    let dangerousPois = [];

    // for each user's visit check the 2 conditions
    for (let userVisit of userVisits) {
        for (let visit of visits) {
            let firstCondition = false;
            let secondCondition = false;

            // check if report history is empty
            if (visit.positiveCases.length) {
                // check if the poi matches the poi of a positive case
                if (visit.poi.equals(userVisit.poi)) {
                    // variables for checking if the user contacted the positive case (+/- two hours)
                    let hourCeil = new Date(visit.createdAt);
                    let hourFloor = new Date(visit.createdAt);
                    hourCeil.setHours(visit.createdAt.getHours() + 2);
                    hourFloor.setHours(visit.createdAt.getHours() - 2);

                    if (userVisit.createdAt <= hourCeil && userVisit.createdAt >= hourFloor) {
                        firstCondition = true;
                    }
                }
                
                // if contact was made then check second condition
                if (firstCondition) {
                    let positiveCases = visit.positiveCases;
                    // iterate through report history
                    for (let positiveCase of positiveCases) {
                        
                        // initializations
                        let dayCeil = new Date(visit.createdAt);
                        let dayFloor = new Date(visit.createdAt);

                        // set time frame
                        dayCeil.setDate(visit.createdAt.getDate() + 7);
                        dayFloor.setDate(visit.createdAt.getDate() - 7);

                        // check if report is within the given time frame
                        if (positiveCase.date <= dayCeil && positiveCase.date >= dayFloor) {
                            secondCondition = true;
                            break; // positive case found, break from loop
                        }
                    }
                }
                if (secondCondition) {
                    const poi = await Poi.findById(visit.poi);
                    const dangerousPoi = {
                        name: poi.name,
                        date: visit.createdAt
                    };
                dangerousPois.push(dangerousPoi); // store dangerous poi
                break; // both conditions met, break from loop
                }
            }
        }
    }

    res.render('tracing', { title: 'Contact Tracing', dangerousPois: dangerousPois });
};