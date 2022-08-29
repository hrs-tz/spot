const fs = require('fs');
let formidable = require('formidable');
const Poi = require("../models/poi");
const Visit = require('../models/visit');
const PositiveCase = require('../models/positive-case');

// handle errors
const handleErrors = (err) => {
    let errors = '';

    // empty file
    if (err.message === 'empty file') {
        errors = 'that email is not registered. Try again...';
    }

    return errors;
}

module.exports.dashboard_get = (req, res) => {
    res.render('dashboard', { title: 'Dashboard'});
};

module.exports.upload_get = (req, res) => {
    res.render('upload', {title: 'Upload'});
};

module.exports.upload_post = (req, res) => {
    
    // create an instance of the form object
    let form = new formidable.IncomingForm();

    // process the file upload in Node
    form.parse(req, function (error, fields, fileUpload) {
        let uploaded = false;
        let filepath = fileUpload.file.filepath;
        let newPath = __dirname + '/../public/docs/pois-upload.json';

        try {
            // copy the uploaded file to a custom folder
            fs.rename(filepath, newPath, function () {
            
                console.log('file uploaded!');
                
                try {
                    // read uploaded file
                    fs.readFile(newPath, async (err, data) => {
                        if (err) {
                            console.log(err.message);
                            const error = err.message;
                            res.json({ error });
                        } 
                        else {
                            // construct json file with pois based on uploaded file
                            const pois = JSON.parse(data); 
                            // attempt to insert pois - first-time insert
                            try {
                                await Poi.insertMany(pois);
                                console.log('Documents inserted to db');
                                res.status(200).json({ file: newPath } );
                            }
                            // some pois already in db - need for insert and update
                            catch (err) {
                                try {
                                    // upload data to db
                                    uploaded = await Poi.uploadPois(pois);
                                    if (uploaded) {
                                        console.log('Pois saved to db!');
                                        res.status(200).json({ file: newPath } );
                                    }
                                }
                                // catch errors during uploading data to db
                                catch (err) {
                                    console.log(err.message);
                                    const error = err.message;
                                    res.json({ error });
                                }
                            }  
                        }
                    });
                }
                // catch errors during reading uploaded file
                catch (err) {
                    console.log(err.message);
                    const error = err.message;
                    res.json({ error });
                }
                
            });
        }
        // catch errors during renaming
        catch (err) {
            console.log(err.message);
            const error = err.message;
            res.json({ error });
        }
    });
};

module.exports.deleteAllPois_delete = async (req, res) => {
    try {
        const numberDeleted = await Poi.deleteMany({});
        if (numberDeleted) {
            console.log('Pois removed from db!');
            res.status(200).json({ deleted: numberDeleted } );
        }
    }
    catch (err) {
        console.log(err);
        const error = err.message;
        res.json({ error });
    }
};

module.exports.statistics_get = (req, res) => {
    res.render('statistics', { title: 'Statistics'});
};

module.exports.populateStatistics_get = async (req, res) => {
    let results = { totalVisits: 0, totalCases: 0, visitsOfPositives: 0, visitsPerType: [], dangerousVisitsPerType: [], visitsPerDay: [], dangerousVisitsPerDay: [], visitsPerHour: [], dangerousVisitsPerHour: [] };

    try {
        results.totalVisits = await Visit.estimatedDocumentCount();
        results.totalCases = await PositiveCase.estimatedDocumentCount();

        // get visits and user's report history for each visit
        const visits = await Visit.aggregate([ 
            { $match: { } },
            { $lookup:
                {
                    from: 'positivecases',
                    localField: 'user',
                    foreignField: 'user',
                    as: 'positiveCases'
                }
            } 
        ]);
        
        // itarate through users' visits
        for (let visit of visits) {
            let positiveCases = visit.positiveCases;
            // iterate through report history
            for (let positiveCase of positiveCases) {

                // initializations
                let dayCeil = new Date();
                let dayFloor = new Date();

                // set time frame
                dayCeil.setDate(positiveCase.date.getDate() + 14);
                dayFloor.setDate(positiveCase.date.getDate() - 7);

                // check if visit is within the given time frame
                if (visit.createdAt <= dayCeil && visit.createdAt >= dayFloor) {
                    // visit is within the given time frame
                    results.visitsOfPositives++; // increase counter for visits by positive cases
                    break; // break from loop and continue to next visit (if any)
                }
            }
        }

        // get visits for each type of poi (descending order)
        results.visitsPerType = await Visit.aggregate([
            { $match: { } },
            { $lookup:
                {
                    from: 'pois',
                    localField: 'poi',
                    foreignField: '_id',
                    as: 'poiInfo'
                }
            },
            {
                $set: {
                  poiInfo: { $arrayElemAt: ["$poiInfo.types", 0] }
                }
            },
            {
                $project: {
                  _id: 0,
                  poiInfo: 1
                }
              },
              {
                $unwind: "$poiInfo"
              },
              {
                $group: {
                  _id: "$poiInfo",
                  totalVisits: {
                    $count: {}
                  }
                }
              },
              {
                $project: {
                  _id: 0,
                  poiInfo: "$_id",
                  totalVisits: 1
                }
              },
              {
                $sort: {
                    totalVisits: -1
                }
              }
        ]);

        // get visits made by positive cases for each type of poi (descending order)
        results.dangerousVisitsPerType = await Visit.aggregate([
            { $match: { } },
            { $lookup:
                {
                    from: 'pois',
                    localField: 'poi',
                    foreignField: '_id',
                    as: 'poiInfo'
                }
            },
            {
                $set: {
                  poiInfo: { $arrayElemAt: ["$poiInfo.types", 0] }
                }
            },
            { $lookup:
                {
                    from: 'positivecases',
                    localField: 'user',
                    foreignField: 'user',
                    pipeline: [
                        { "$sort" : { "date" : -1 }}
                    ],
                    as: 'testDate'
                }
            },
            {
                $set: {
                  testDate: { $arrayElemAt: ["$testDate.date", 0] }
                }
            },
            {
                $match:
                {
                    $and: [
                        { $expr:
                            {
                                $lt:
                                [ "$createdAt",
                                    {
                                        $dateAdd:
                                        {
                                            startDate: "$testDate",
                                            unit: "day",
                                            amount: 15
                                        }
                                    }
                                ]
                            }
                        },
                        { $expr:
                            {
                                $gt:
                                [ "$createdAt",
                                    {
                                        $dateAdd:
                                        {
                                            startDate: "$testDate",
                                            unit: "day",
                                            amount: -8
                                        }
                                    }
                                ]
                            }
                        }
                    ]   
                }
            },
            {
                $project: {
                    _id: 0,
                    poiInfo: 1
                }
            },
            {
                $unwind: "$poiInfo"
            },
            {
                $group: {
                    _id: "$poiInfo",
                    totalVisits: {
                    $count: {}
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    poiInfo: "$_id",
                    totalVisits: 1
                }
            },
            {
                $sort: {
                    totalVisits: -1
                }
            }
        ]);

        // time interval
        const to = new Date('2022-08-31T00:00:00.777+00:00').toISOString().split('T')[0];
        const from = new Date('2022-08-01T00:00:00.777+00:00').toISOString().split('T')[0];

        // get visits per day
        results.visitsPerDay = await Visit.aggregate([
            { $addFields: { "creationDate":  {$dateToString:{format: "%Y-%m-%d", date: "$createdAt"}}}},
            { $match: { creationDate: { $gte: from, $lte: to} } },
            {
                $group: {
                    _id: "$creationDate",
                    totalVisits: {
                    $count: {}
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: "$_id",
                    totalVisits: 1
                }
            },
            {
                $sort: {
                    date: 1
                }
            }
        ]);

        // get visits made by positive cases per day
        results.dangerousVisitsPerDay = await Visit.aggregate([
            { $addFields: { "creationDate":  {$dateToString:{format: "%Y-%m-%d", date: "$createdAt"}}}},
            { $match: { creationDate: { $gte: from, $lte: to} } },
            { $lookup:
                {
                    from: 'positivecases',
                    localField: 'user',
                    foreignField: 'user',
                    pipeline: [
                        { "$sort" : { "date" : -1 }}
                    ],
                    as: 'testDate'
                }
            },
            {
                $set: {
                  testDate: { $arrayElemAt: ["$testDate.date", 0] }
                }
            },
            {
                $match:
                {
                    $and: [
                        { $expr:
                            {
                                $lt:
                                [ "$createdAt",
                                    {
                                        $dateAdd:
                                        {
                                            startDate: "$testDate",
                                            unit: "day",
                                            amount: 15
                                        }
                                    }
                                ]
                            }
                        },
                        { $expr:
                            {
                                $gt:
                                [ "$createdAt",
                                    {
                                        $dateAdd:
                                        {
                                            startDate: "$testDate",
                                            unit: "day",
                                            amount: -8
                                        }
                                    }
                                ]
                            }
                        }
                    ]   
                }
            },
            {
                $group: {
                    _id: "$creationDate",
                    totalVisits: {
                    $count: {}
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: "$_id",
                    totalVisits: 1
                }
            },
            {
                $sort: {
                    date: 1
                }
            }
        ]);

        // time selection
        const selectedDate = new Date('2022-08-28T00:00:00.777+00:00').toISOString().split('T')[0];

        // get visits per hour
        results.visitsPerHour = await Visit.aggregate([
            { $addFields: { "creationDate":  {$dateToString:{format: "%Y-%m-%d", date: "$createdAt"}}}},
            { $project: { 
                    hour: { $toString: { $hour: "$createdAt" } },
                    user: 1,
                    poi: 1,
                    createdAt: 1,
                    creationDate: 1
                }
            },
            { $match: { creationDate: { $eq: selectedDate } } },
            {
                $group: {
                    _id: "$hour",
                    totalVisits: {
                    $count: {}
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: "$_id",
                    totalVisits: 1
                }
            },
            {
                $sort: {
                    date: 1
                }
            }
        ]);

        // get visits made by positive cases per hour
        results.dangerousVisitsPerHour = await Visit.aggregate([
            { $addFields: { "creationDate":  {$dateToString:{format: "%Y-%m-%d", date: "$createdAt"}}}},
            { $project: 
                { 
                    hour: { $toString: { $hour: "$createdAt" } },
                    user: 1,
                    poi: 1,
                    createdAt: 1,
                    creationDate: 1
                }
            },
            { $match: { creationDate: { $eq: selectedDate } } },
            { $lookup:
                {
                    from: 'positivecases',
                    localField: 'user',
                    foreignField: 'user',
                    pipeline: [
                        { "$sort" : { "date" : -1 }}
                    ],
                    as: 'testDate'
                }
            },
            {
                $set: {
                  testDate: { $arrayElemAt: ["$testDate.date", 0] }
                }
            },
            {
                $match:
                {
                    $and: [
                        { $expr:
                            {
                                $lt:
                                [ "$createdAt",
                                    {
                                        $dateAdd:
                                        {
                                            startDate: "$testDate",
                                            unit: "day",
                                            amount: 15
                                        }
                                    }
                                ]
                            }
                        },
                        { $expr:
                            {
                                $gt:
                                [ "$createdAt",
                                    {
                                        $dateAdd:
                                        {
                                            startDate: "$testDate",
                                            unit: "day",
                                            amount: -8
                                        }
                                    }
                                ]
                            }
                        }
                    ]   
                }
            },
            {
                $group: {
                    _id: "$hour",
                    totalVisits: {
                    $count: {}
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: "$_id",
                    totalVisits: 1
                }
            },
            {
                $sort: {
                    date: 1
                }
            }
        ]);

        // replace _ with space in poi types for readability
        results.visitsPerType.forEach(item => {
            item.poiInfo = item.poiInfo.replaceAll('_',' ');
        });

        results.dangerousVisitsPerType.forEach(item => {
            item.poiInfo = item.poiInfo.replaceAll('_',' ');
        });

        res.status(200).json({ results });
    }
    catch (err) {
        console.log(err);
        const error = err.message;
        res.json({ error });
    }
    


};