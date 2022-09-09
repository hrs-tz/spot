const Visit = require('../models/visit');
const Poi = require('../models/poi');
const mongoose = require('mongoose');
const NodeCache = require( "node-cache" );

const tracingCache = new NodeCache({ stdTTL: 30000 }); // 30sec default TTL

module.exports.tracing_get = async (req, res) => {
    // variables for getting user's visits for the last 7 days
    const currentDate = new Date();
    const aWeekEarlier = new Date();
    aWeekEarlier.setDate(currentDate.getDate() - 7);
    
    // get user's visits for the last 7 days and number of user's visits for pagination
    const userVisits = await Visit.find({$and: [ 
        { createdAt: { $gte: aWeekEarlier, $lte: currentDate } },
        { user: res.locals.user } 
    ] }).limit(20);
    let maxPage = await Visit.countDocuments({$and: [ 
        { createdAt: { $gte: aWeekEarlier, $lte: currentDate } },
        { user: res.locals.user } 
    ] });
    maxPage = Math.ceil(maxPage / 20);

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
                        address: poi.address,
                        date: (new Date(visit.createdAt)).toString().split('GMT')[0]
                    };
                dangerousPois.push(dangerousPoi); // store dangerous poi
                break; // both conditions met, break from loop
                }
            }
        }
    }

    res.render('tracing', { title: 'Contact Tracing', dangerousPois: dangerousPois, maxPage: maxPage });
};

module.exports.dangerousVisitsPages_post = async (req, res) => {
    const pageCount = req.body.page;

    // every page has 20 results
    const visitsSkipped = 20 * pageCount;

    const keyPage = 'tracing' + pageCount;

    // check cache
    if (tracingCache.has(keyPage)) {
        console.log('cache hit');
        res.status(200).json(tracingCache.get(keyPage));
    }
    else {
        console.log('cache miss');
        try {
            // variables for getting user's visits for the last 7 days
            const currentDate = new Date();
            const aWeekEarlier = new Date();
            aWeekEarlier.setDate(currentDate.getDate() - 7);
            
            // get user's visits for the last 7 days -> add here limit and skip
            const userVisits = await Visit.find({$and: [ 
                { createdAt: { $gte: aWeekEarlier, $lte: currentDate } },
                { user: res.locals.user } 
            ] }).skip(visitsSkipped).limit(20);
    
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
                                address: poi.address,
                                date: (new Date(visit.createdAt)).toString().split('GMT')[0]
                            };
                        dangerousPois.push(dangerousPoi); // store dangerous poi
                        break; // both conditions met, break from loop
                        }
                    }
                }
            }
    
            // add to cache with TTL 1min
            tracingCache.set(keyPage, { dangerousPois }, 60000);
            res.json({ dangerousPois });
        }
        catch (err) {
            console.log(err);
            const error = err.message
            res.send(error);
        }
    }
    
};