//jshint esversion:6
require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
//all the below require - for the passportjs.
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
//for authenticating with google
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");


//this is used for hashing - High security Authentication.

const md5 = require("md5");


const encrypt = require("mongoose-encryption");

const app = express();

app.use(express.static("public"));
app.set("view engine" , "ejs");
app.use(bodyParser.urlencoded({extended:true}));

//where you place this is also important. 
app.use(session({
  secret: 'Our little secrets',
  resave: false,
  saveUninitialized: false,
//   cookie: { secure: true }
}))

app.use(passport.initialize());

app.use(passport.session());





mongoose.connect("mongodb://localhost:27017/userDB",{useNewUrlParser : true});

//we change Schema because we are using encryption.
const userSchema =new mongoose.Schema({
    email:String,
    password : String,
    googleId : String,
    secret : String
});

userSchema.plugin(passportLocalMongoose);

userSchema.plugin(findOrCreate); 

//all this is for not showing the password in the database also.
//we can use the gitignore to ignore posting this .env file in perticular
// userSchema.plugin(encrypt,{secret : process.env.SECRET , encryptedFields : ["password"]});

const User =new mongoose.model("User",userSchema);

// use static authenticate method of model in LocalStrategy
passport.use(User.createStrategy());

// use static serialize and deserialize of model for passport session support
passport.serializeUser(function(user,done){
  done(null , user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id)
    .then(user => {
      done(null, user);
    })
    .catch(err => {
      done(err, null);
    });
});
//all this is from => https://www.passportjs.org/packages/passport-google-oauth20/

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "http:/www.googleapis.com/auth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));




app.get("/" , function(req,res){
    res.render("home");
});


app.get('/auth/google',
  passport.authenticate("google", { scope: ["profile"] }));

app.get("/auth/google/secrets", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
  });



app.get("/login", function(req, res) {
    res.render("login", { errorMessage: "" });
});

app.get("/register" , function(req,res){
    res.render("register");
}); 

app.get("/secrets", function(req,res){
    if(req.isAuthenticated){
         res.render("secrets");
    }
    else{
        res.redirect("/login");
    }
});

app.get("/submit", function(req,res){
  if(req.isAuthenticated){
       res.render("submit");
  }
  else{
      res.redirect("/login");
  }
});

app.post("/submit", function(req, res) {
  const submittedSecret = req.body.secret;

  User.findById(req.user.id)
    .then(foundUser => {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        return foundUser.save();
      }
    })
    .then(() => {
      res.redirect("/secrets");
    })
    .catch(err => {
      console.log(err);
    });
});


//from the passportjs web doccumentation
app.get('/logout', function(req, res, next) {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });

//go through the passportjs website doccumention
app.post("/register", function(req, res) {
    const username = req.body.username;
    const password = req.body.password;
  
    const newUser = new User({ username: username });
    User.register(newUser, password, function(err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function() {
          res.redirect("/secrets");
        });
      }
    });
  });
  

  app.post("/login", function(req, res) {
    const username = req.body.username;
    const password = req.body.password;
  
    const user = new User({ username: username, password: password });
  
    req.login(user, function(err) {
      if (err) {
        console.log(err);
        res.redirect("/login");
      } else {
        passport.authenticate("local")(req, res, function() {
          res.redirect("/secrets");
        });
      }
    });
  });
  
  




app.listen(3000,function(){
    console.log("Server started on port 3000");
});