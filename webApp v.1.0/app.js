const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const cookieParser = require('cookie-parser');
const { requireAuth, requireAdminAuth, checkUser } = require('./middleware/authMiddleware');
const homeController = require('./controllers/homeController')
const profileController = require('./controllers/profileController');
const reportController = require('./controllers/reportController');
const tracingController = require('./controllers/tracingController');
const adminController = require('./controllers/adminController');
const Admin = require('./models/admin');

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
//         id: "ChIJ4bvbRlU3XhMRizrDqc9I6fU",
//         name: "Flocafe",
//         address: "Akti Dimeon 17, Patra",
//         types: ["cafe", "food", "point_of_interest", "establishment"],
//         coordinates: {lat: 38.2376827, lng: 21.7259359},
//         rating: 4.1,
//         rating_n: 246,
//         populartimes: [
//             {name: "Monday",
//             data: [0, 0, 0, 0, 0, 0, 0, 0, 19, 43, 56, 47, 31, 23, 21, 18, 16, 17, 24, 30, 31, 23, 13, 5]
//             },
//             {name: "Tuesday",
//             data: [0, 0, 0, 0, 0, 0, 0, 0, 19, 44, 59, 49, 25, 14, 19, 29, 28, 16, 13, 29, 44, 25, 5, 0]
//             },
//             {name: "Wednesday",
//             data: [0, 0, 0, 0, 0, 0, 0, 0, 12, 21, 32, 36, 33, 24, 16, 12, 15, 22, 30, 33, 29, 20, 11, 5]
//             },
//             {name: "Thursday",
//             data: [0, 0, 0, 0, 0, 0, 0, 0, 17, 31, 21, 27, 28, 24, 18, 16, 20, 30, 37, 39, 33, 21, 11, 4]
//             },
//             {name: "Friday",
//             data: [0, 0, 0, 0, 0, 0, 0, 0, 16, 28, 39, 47, 46, 37, 25, 15, 7, 7, 16, 30, 41, 38, 23, 9]
//             },
//             {name: "Saturday",
//             data: [0, 0, 0, 0, 0, 0, 0, 0, 7, 16, 22, 33, 66, 100, 90, 46, 14, 9, 29, 61, 70, 45, 16, 2]
//             },
//             {name: "Sunday",
//             data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 29, 49, 56, 45, 27, 17, 25, 47, 67, 73, 59, 36, 0, 0]
//             }
//         ]
//     });

//     poi.save()
//         .then((result) => {
//             res.send(result);
//         })
//         .catch((err) => {
//             console.log(err);
//         })
// });

app.get('/add-admin', (req, res) => {
    const admin = new Admin({
        username: 'admin',
        password: 'admin'
    });

    admin.save()
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            console.log(err);
        });
})

// routes

app.get('*', checkUser); // get user id for get requests
app.post('*', checkUser); // get user id for post requests

app.get('/', (req, res) => {
    res.render('landingPage', { title: 'Get started' });
});

app.use(authRoutes);

// protected routes

app.get('/home', requireAuth, homeController.home_get);

app.post('/home', requireAuth, homeController.home_post);

app.post('/add-visit', requireAuth, homeController.addVisit_post);

app.get('/report', requireAuth, reportController.report_get);

app.post('/report', requireAuth, reportController.report_post);

app.get('/contact-tracing', requireAuth, tracingController.tracing_get);

app.get('/dangerousVisitsPages', requireAuth, tracingController.dangerousVisitsPages_post);

app.get('/profile', requireAuth, profileController.profile_get);

app.post('/profile', requireAuth, profileController.profile_post);

app.post('/visitsPages', requireAuth, profileController.visitsPages_post);

app.post('/positiveCasesPages', requireAuth, profileController.positiveCasesPages_post);

app.get('/dashboard', requireAdminAuth, adminController.dashboard_get);

app.get('/populate-statistics', requireAdminAuth, adminController.populateStatistics_get);

app.post('/populate-chart-per-day', requireAdminAuth, adminController.populateChartPerDay_post);

app.post('/populate-chart-per-hour', requireAdminAuth, adminController.populateChartPerHour_post);

app.get('/upload', requireAdminAuth, adminController.upload_get);

app.post('/upload', requireAdminAuth, adminController.upload_post);

app.delete('/delete-all-pois', requireAdminAuth, adminController.deleteAllPois_delete);

app.post('/add-system-data', requireAdminAuth, adminController.addSystemData_post);

// 404 page
app.use((req, res) => {
    res.status(404).render('404', { title: '404' });
});