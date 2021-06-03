//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
// const encrypt = require("mongoose-encryption");
// const bcrypt = require("bcrypt");
// const saltRounds = 10;
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const port = process.env.PORT || 3000;

const dbURL = "mongodb://127.0.0.1:27017/userDB";
mongoose
    .connect(dbURL, {
        useCreateIndex: true,
        useFindAndModify: true,
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("Database Connection Successful");
    })
    .catch((err) => {
        console.log(err);
    });

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(
    session({
        secret: "This is my new secret.",
        resave: false,
        saveUninitialized: false,
    })
);
app.use(passport.initialize());
app.use(passport.session());

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String,
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
// const secret = process.env.SECRET;
// userSchema.plugin(encrypt, {
//     secret: secret,
//     encrptedFields: ["password"],
//     excludeFromEncryption: ["email"],
// });
const User = new mongoose.model("User", userSchema);
passport.use(User.createStrategy());

// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

passport.use(
    new GoogleStrategy({
            clientID: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            callbackURL: "http://localhost:3000/auth/google/secrets",
            userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
        },
        function(accessToken, refreshToken, profile, cb) {
            console.log("profile", profile);
            User.findOrCreate({ googleId: profile.id }, function(err, user) {
                return cb(err, user);
            });
        }
    )
);

app.get("/", (req, res) => {
    res.render("home");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.get("/secrets", (req, res) => {
    User.find({ secret: { $ne: null } }, function(err, foundUsers) {
        if (err) {
            console.log(err);
        } else {
            if (foundUsers) {
                res.render("secrets", { userWithSecrets: foundUsers });
            }
        }
    });
    // if (req.isAuthenticated()) {
    //     res.render("secrets");
    // } else {
    //     res.render("login");
    // }
});
app.get("/submit", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/submit", (req, res) => {
    const submittedSecret = req.body.secret;

    User.findById(req.user.id, function(err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save(function() {
                    res.redirect("/secrets");
                });
            }
        }
    });
});
app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/");
});

app.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile"] })
);

app.get(
    "/auth/google/secrets",
    passport.authenticate("google", { failureRedirect: "/login" }),
    function(req, res) {
        // Successful authentication, redirect secret page.
        res.redirect("/secrets");
    }
);

app.post("/register", (req, res) => {
    User.register({ username: req.body.username },
        req.body.password,
        function(err, user) {
            if (err) {
                console.log(err);
            } else {
                passport.authenticate("local")(req, res, function() {
                    res.redirect("/secrets");
                });
            }
        }
    );
});
// bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
//     const newUser = new User({
//         email: req.body.username,
//         password: hash,
//     });
//     newUser.save((err) => {
//         if (err) {
//             console.log(err);
//         } else {
//             res.render("secrets");
//         }
//     });
// });
// });

app.post("/login", (req, res) => {
    const user = new User({
        username: req.body.username,
        password: req.body.password,
    });
    req.login(user, function(err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
            });
        }
    });
});
//     const username = req.body.username;
//     const password = req.body.password;
//     User.findOne({ email: username }, function(err, userFound) {
//         if (err) {
//             console.log(err);
//         } else {
//             if (userFound) {
//                 bcrypt.compare(password, userFound.password, function(err, result) {
//                     if (result === true) {
//                         res.render("secrets");
//                     } else {
//                         console.log(err);
//                     }
//                 });
//             }
//         }
//     });
// });

app.listen(port, () => {
    console.log(`Listening to port ${port}`);
});