const Poi = require('../models/poi');
const Visit = require('../models/visit');

module.exports.home_get = (req, res) => {
    res.render('home', { title: 'Home' });
}

module.exports.home_post = (req, res) => {
    bounds = req.body.bounds;
    
    // get pois based on map bounds
    Poi.aggregate([
        { 
            $match: 
            { $and: [ 
                { 'coordinates.lat' : { $gte: bounds._southWest.lat , $lte: bounds._northEast.lat } },
                { 'coordinates.lng' : { $gte: bounds._southWest.lng , $lte: bounds._northEast.lng } } 
            ] }
        }
    ])
    .then(result => {
        res.json({ result });
    })
    .catch(err => {
        console.log(err);
        res.send(err);
    });
}

module.exports.addVisit_post = (req, res) => {
    const { poiId, estimation } = req.body;
    let visit = '';
    if (estimation === 'empty') {
        visit = new Visit({
            user: res.locals.user,
            poi: poiId,
        });
    }
    else {
        visit = new Visit({
            user: res.locals.user,
            poi: poiId,
            estimation: estimation
        });
    }
    
    visit.save()
        .then(async (result) => {
            
            if (result.estimation) {

                const avgEstimation = await Visit.aggregate([
                    { 
                        $project: { 
                            user: 1,
                            poi: 1,
                            createdAt: 1,
                            estimation: 1
                        }
                    },
                    { 
                        $match: { $and: [
                            { $expr:
                                {
                                    $gte:
                                    [ "$createdAt",
                                        {
                                            $dateAdd:
                                            {
                                                startDate: "$createdAt",
                                                unit: "hour",
                                                amount: -2
                                            }
                                        }
                                    ]
                                }
                            }, 
                            { poi: result.poi } 
                        ] } 
                    },
                    {
                        $group: {
                            _id: "$poi",
                            current_popularity: {
                            $avg: "$estimation"
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            poi: "$_id",
                            current_popularity: { $round: [ "$current_popularity", 0 ] }
                        }
                    }
                ]);
        
                console.log(avgEstimation[0].current_popularity);
                const poi = await Poi.findById(result.poi);
                poi.current_popularity = avgEstimation[0].current_popularity;
                await poi.save();
            }
            res.send(result);
        })
        .catch((err) => {
            console.log(err);
            if (err.message.includes('Invalid estimation: estimation must be a positive integer')) {
                const error = 'Invalid estimation: estimation must be a positive integer';
                res.json({ error });
            }
            else {
                res.send(err);
            }
        });
}