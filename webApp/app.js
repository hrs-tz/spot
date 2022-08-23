const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const Poi = require('./models/poi');
const Visit = require('./models/visit');
const authRoutes = require('./routes/authRoutes');
const cookieParser = require('cookie-parser');
const { requireAuth, checkUser } = require('./middleware/authMiddleware');
const homeController = require('./controllers/homeController')
const profileController = require('./controllers/profileController');
const reportController = require('./controllers/reportController');
const tracingController = require('./controllers/tracingController');

// express app
const app = express();

// connect to mongodb
const dbURI = 'mongodb+srv://hrs:webProject2022@spot.vkkuodf.mongodb.net/spot?retryWrites=true&w=majority';
mongoose.connect(dbURI)
    .then((result) => {
        console.log('db connection established')
        // listen for requests
        const server = app.listen(3000);
    })
    .catch((err) => console.log(err));

// register view engine
app.set('view engine', 'ejs');

// middleware and static files
app.use('/public', express.static('public')); // access statics from public folder
app.use('/leaflet-search', express.static('node_modules/leaflet-search'));
app.use(express.urlencoded({ extended: true })); // access form data
app.use(express.json());
app.use(morgan('dev')); // for logs
app.use(cookieParser());

// test db save poi
// app.get('/test-db', (req, res) => {
//     const poi = new Poi({
//         id: "ChIJ8yJ6relJXhMRo2XqEv0keZU",
//         name: "SUPERMARKET \"3A ARAPIS\"",
//         address: "Maizonos 22-24, Patra",
//         types: ["supermarket", "grocery_or_supermarket", "food", "point_of_interest", "store", "establishment"],
//         coordinates: {
//             lat: 38.25060850000001,
//             lng: 21.7398956
//         },
//         rating: 4.2,
//         rating_n: 232,
//         current_popularity: 29,
//         populartimes: [
//             {name: "Monday",
//             data: [0, 0, 0, 0, 0, 0, 0, 0, 19, 38, 60, 79, 89, 86, 70, 50, 33, 40, 71, 83, 49, 0, 0, 0]
//             },
//             {name: "Tuesday",
//             data: [0, 0, 0, 0, 0, 0, 0, 0, 16, 32, 49, 65, 74, 73, 62, 46, 37, 53, 84, 88, 49, 0, 0, 0]
//             }, 
//             {name: "Wednesday",
//             data: [0, 0, 0, 0, 0, 0, 0, 0, 12, 35, 51, 58, 81, 100, 78, 52, 46, 46, 44, 40, 33, 0, 0, 0]
//             },
//             {name: "Thursday",
//             data: [0, 0, 0, 0, 0, 0, 0, 0, 16, 30, 45, 59, 67, 66, 57, 46, 40, 46, 60, 64, 49, 0, 0, 0]
//             },
//             {name: "Friday",
//             data: [0, 0, 0, 0, 0, 0, 0, 0, 12, 26, 44, 60, 69, 64, 51, 36, 32, 47, 67, 68, 42, 0, 0, 0]
//             },
//             {name: "Saturday",
//             data: [0, 0, 0, 0, 0, 0, 0, 0, 5, 21, 44, 67, 80, 78, 64, 49, 38, 32, 25, 16, 0, 0, 0, 0]
//             },
//             {name: "Sunday",
//             data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
//             }
//         ],
//         time_spent: [15,15]
//     });

//     poi.save()
//         .then((result) => {
//             res.send(result);
//         })
//         .catch((err) => {
//             console.log(err);
//         })
// });

// test get all documents from db
app.get('/all-pois', (req, res) => {
    Poi.find()
        .then((result) => {
            res.json({ result });
        })
        .catch((err) => {
            console.log(err);
        });
});

// routes

app.get('*', checkUser); // get user id for get requests
app.post('*', checkUser); // get user id for post requests

app.get('/', (req, res) => {
    res.render('landingPage', { title: 'Get started' });
});

app.use(authRoutes);

// protected routes

// test db save visit
app.get('/add-visit', requireAuth, (req, res) => {
    const visit = new Visit({
        user: res.locals.user,
        poi: "62ed58ff42ee406b9c451b6c",
        estimation: 2
    });

    visit.save()
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            console.log(err);
        });
})

app.get('/home', requireAuth, homeController.home_get);

app.get('/report', requireAuth, reportController.report_get);

app.post('/report', requireAuth, reportController.report_post);

app.get('/contact-tracing', requireAuth, tracingController.tracing_get);

app.get('/profile', requireAuth, profileController.profile_get);

app.post('/profile', requireAuth, profileController.profile_post)

// 404 page
app.use((req, res) => {
    res.status(404).render('404', { title: '404' });
});