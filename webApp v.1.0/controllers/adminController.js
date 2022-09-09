const fs = require('fs');
let formidable = require('formidable');
const Poi = require("../models/poi");
const Visit = require('../models/visit');
const PositiveCase = require('../models/positive-case');
const User = require('../models/user');
const NodeCache = require( "node-cache" );

const statisticsCache = new NodeCache({ stdTTL: 30000 }); // 30sec default TTL

// function to check if a poi is within 20 meters from user's location - haversine formula to calculate the great-circle distance between two points
// code credits: https://www.movable-type.co.uk/scripts/latlong.html
const distanceCalculator = (lat1, lon1, lat2, lon2) => {
    
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const distance = (R * c) / 1000; // distance in km

    return distance;
}

// handle errors
const handleErrors = (err) => {
    console.log(err.message, err.code);
    let errors = { number: '', startDate: '', endDate: '', general: ''};

    // incorrect number
    if (err.message === 'incorrect number') {
        errors.number = 'Number must be a positive integer. Try again...';
    }

    // empty startDate
    if (err.message === 'empty startDate') {
        errors.startDate = 'Start date is empty. Try again...'
    }

    // empty endDate
    if (err.message === 'empty endDate') {
        errors.endDate = 'End date is empty. Try again...';
    }

    // future endDate
    if (err.message === 'future endDate') {
        errors.endDate = 'Future end date. Try again...';
    }

    // invalid endDate
    if (err.message === 'invalid endDate') {
        errors.endDate = 'End date is before start date. Try again...';
    }

    // duplicate error code
    if (err.code === 11000) {
        errors.general = 'Script already ran';
        return errors;
    }

    return errors;
}

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
                            try {
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
                            catch (err) {
                                console.log(err.message);
                                const error = 'Not a .json file. Try with another file...';
                                res.json({ error });
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

module.exports.dashboard_get = (req, res) => {
    // get current date
    const today = new Date();
    let startDate = new Date();
    let currentDate = new Date();

    // get current date and date 7 days ago (format: yyyy-mm-dd), slice to fill with zeros month and day
    currentDate = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
    startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    startDate = startDate.getFullYear() + '-' + ('0' + (startDate.getMonth() + 1)).slice(-2) + '-' + ('0' + startDate.getDate()).slice(-2);

    res.render('dashboard', { title: 'Dashboard', currentDate: currentDate, startDate: startDate });
};

module.exports.populateStatistics_get = async (req, res) => {
    let results = { totalVisits: 0, totalCases: 0, visitsOfPositives: 0, totalUsers: 0, visitsPerType: [], dangerousVisitsPerType: [] };

    // check cache
    if (statisticsCache.has('statistics')) {
        console.log('cache hit');
        res.status(200).json(statisticsCache.get('statistics'));
    }
    else {
        console.log('cache miss');
        try {
            results.totalVisits = await Visit.estimatedDocumentCount();
            results.totalCases = await PositiveCase.estimatedDocumentCount();
            results.totalUsers = await User.estimatedDocumentCount();
    
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
    
            // replace _ with space in poi types for readability
            results.visitsPerType.forEach(item => {
                item.poiInfo = item.poiInfo.replaceAll('_',' ');
            });
    
            results.dangerousVisitsPerType.forEach(item => {
                item.poiInfo = item.poiInfo.replaceAll('_',' ');
            });
    
            // add to cache with TTL 5min
            statisticsCache.set('statistics', { results }, 300000);
            res.status(200).json({ results });
        }
        catch (err) {
            console.log(err);
            const error = err.message;
            res.send(error);
        }
    }
};

module.exports.populateChartPerDay_post = async (req, res) => {
    let results = { visitsPerDay: [], dangerousVisitsPerDay: [] };

    // time interval and date selection
    const { from, to } = req.body;

    // check cache
    if (statisticsCache.has('perDay')) {
        console.log('cache hit');
        res.status(200).json(statisticsCache.get('perDay'));
    }
    else {
        console.log('cache miss');

        try {
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
    
            // add to cache with TTL 5min
            statisticsCache.set('perDay', { results }, 300000);
            res.status(200).json({ results });
        }
        catch (err) {
            console.log(err);
            const error = err.message;
            res.send(error);
        }
    }
};

module.exports.populateChartPerHour_post = async (req, res) => {
    let results = { visitsPerHour: [], dangerousVisitsPerHour: [] };

    // date selection
    const { selectedDate } = req.body;

    // check cache
    if (statisticsCache.has('perHour')) {
        console.log('cache hit');
        res.status(200).json(statisticsCache.get('perHour'));
    }
    else {
        console.log('cache miss');
        
        try {
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
    
            // add to cache with TTL 5min
            statisticsCache.set('perHour', { results }, 300000);
            res.status(200).json({ results });
        }
        catch (err) {
            console.log(err);
            const error = err.message;
            res.send(error);
        }
    }
};

module.exports.addSystemData_post = async (req, res) => {

    const { numberOfUsers, startDateInput, endDateInput} = req.body;
    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);

    try {

        // check user input
        if (Number.isInteger(numberOfUsers) || numberOfUsers < 1) {
            throw Error('incorrect number');
        }

        if (!startDateInput) {
            throw Error('empty startDate');
        }

        if (!endDateInput) {
            throw Error('empty endDate');
        }

        let date = new Date();
        date = date.getFullYear() + '-' + ('0' + (date.getMonth()+1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);

        if (endDateInput > date) {
            throw Error('future endDate');
        }

        if (endDateInput < startDateInput) {
            throw Error('invalid endDate');
        }

        for (let userIndex = 0; userIndex < numberOfUsers; userIndex++) {
            let visits = [];
            let tempDate = new Date(startDate);
            const username = 'User' + (userIndex + 1);
            const password = 'User' + (userIndex + 1) + 'pass!';
            const email = 'user' + (userIndex + 1) + '@example.com';
            
            const user = new User({
                username: username,
                password: password,
                email: email
            });
            
            const result = await user.save();

            // loop through given time box
            while (tempDate < endDate) {

                // array to hold datetimes for visits per day
                let createdAtArray = [];

                // get a random poi
                const randomPoi = await Poi.aggregate([
                    { $sample: { size: 1 } }
                ]);

                // get random datetime
                let createdAt = new Date(tempDate);
                createdAt.setHours(createdAt.getHours() + Math.floor(Math.random() * (15 - 7) + 7)); // random time from 7am to 2 pm
                
                // add first datetime to array
                createdAtArray[0] = new Date(createdAt);

                // first visit to random poi
                let visit = {
                    'user': result._id,
                    'poi': randomPoi[0]._id,
                    'createdAt': createdAt
                };
        
                visits.push(visit);
        
                // next n visits of the day
                const n = Math.floor(Math.random() * (10 - 5) + 5);
                for (let visitIndex = 1; visitIndex <= n; visitIndex++) {
                
                    // get random distance between 1 to 4 km
                    let distance = Math.floor(Math.random() * (5 - 1) + 1);
                
                    // get pois within the random distance
                    const nearPois = await Poi.find(
                        { coordinates: 
                            { $geoWithin :
                                { $centerSphere :
                                    [[ randomPoi[0].coordinates.lng, randomPoi[0].coordinates.lat] , distance / 6371] // km to radians: radians = km / 6371
                                }
                            }
                        }
                    ); // ολα συγκρίνονται ως προς την απόσταση από το αρχικό μονο??? (randomPoi[0])
                
                    // get a random poi within the random distance
                    const poi = nearPois[Math.floor(Math.random() * nearPois.length)];

                    distance = distanceCalculator(randomPoi[0].coordinates.lat, randomPoi[0].coordinates.lng, poi.coordinates.lat, poi.coordinates.lng);

                    // calculate travel time
                    let minutesToAdd = distance / 3;

                    // add time spent
                    minutesToAdd += Math.floor(Math.random() * (121 - 10) + 10);

                    // temp variable to hold previous datetime
                    let createdAtNext = new Date(createdAtArray[visitIndex - 1]);

                    // set time of visit based on travel time and time spent and add datetime to array
                    createdAtNext.setMinutes(createdAtNext.getMinutes() + minutesToAdd);
                    createdAtArray[visitIndex] = new Date(createdAtNext);

                    visit = {
                        'user': result._id,
                        'poi': poi._id,
                        'createdAt': createdAtArray[visitIndex]
                    };
                    
                    visits.push(visit);
                }

                // next day
                tempDate.setDate(tempDate.getDate() + 1);
            }
            await Visit.insertMany(visits); 
        }
        const message = 'Script executed successfully'
        res.json({ message });  
    }
    catch (err) {
        console.log(err);
        const errors = handleErrors(err);
        res.json({ errors });
    }
}