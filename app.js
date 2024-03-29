//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser")
const mongoose = require("mongoose");
const ejs = require("ejs");
const nodemailer = require("nodemailer");
const session = require("express-session");
const MongoStore = require('connect-mongo')(session);
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const stripe = require('stripe')(process.env.STRIPE_KEY);
const easyinvoice = require("easyinvoice");

const app = express();

app.set("view engine" , "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.set('trust proxy', 1);

app.use(session({
    resave : false,
    saveUninitialized : false,
    secret : process.env.PASSPORT_KEY,
    store: new MongoStore({ mongooseConnection: mongoose.connection })
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.set("strictQuery" ,false);

const connectDB = async () => {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
  
    } catch (error) {
      console.log(error);
      process.exit(1);
    }
};

const userSchema = new mongoose.Schema({
    email : {type:String, unique:true},
    username : {type:String, unique:true},
    name : String,
    password : String
});
userSchema.plugin(passportLocalMongoose);


const gameListSchema = new mongoose.Schema({
    gameName : {type : String, unique : true},
    gamePrice : String,
    gameCover : String
});

const cartSchema =  new mongoose.Schema({
    userCart : String,
    name : String,
    price : String,
    coverPic : String
});

const orderSchema = new mongoose.Schema({
    orderBy : String,
    custName : String,
    custEmail : String,
    orderDate : String,
    orderID : {type : String , unique : true},
    amount : String,
    status : String,
});

const User = mongoose.model("User" , userSchema);
const Order = mongoose.model("Order" , orderSchema);
const CartItem = mongoose.model("CartItem" , cartSchema);
const GameList = mongoose.model("GameList" , gameListSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.get("/" , function(req,res){
    if (req.isAuthenticated()){
        var a = true;
    } else {
        var a = false;
    }
    GameList.find({} , function(err , lol){
        if (err){
            console.log(err);
        } else {
            res.render("home" , {foundGames : lol , auth : a})
        }
    });
});

app.get("/register" , function(req,res){
    res.render("register");
});

app.get("/login" , function(req,res){
    res.render("login");
});

app.get("/logout" , function(req,res){
    if (req.isAuthenticated()){
        req.logout(function(err){});
        res.render("success/loggedout");
    } else {
        res.redirect("/login");
    }
});

app.get("/forgotcred" , function(req,res){
    res.render("forgotcred");
});

app.get("/forgotuid" , function(req,res){
    res.render("forgotuid");
});

app.post("/forgotuid" , function(req,res){
    const userEmail = req.body.email;
    User.findOne({email : userEmail} , async function(err , foundUser){
        if(foundUser!=null){
            var body = `Dear ${foundUser.name},\n \nYour Username is  ${foundUser.username}.\n \nRegards,\nAdmin\nGameSwitch LLC`
            let mailTransporter = await nodemailer.createTransport({
                service : "gmail",
                auth : {
                    user : process.env.MAIL_ID,
                    pass : process.env.MAIL_PASS
                },
                tls:{
                    rejectUnauthorized:false
                }
            });
            
        
            let details = {
                from : process.env.MAIL_ID,
                to : userEmail,
                subject : "Username Retrieval",
                text : body
                }
        
            await mailTransporter.sendMail(details , function(err){
                if(err){
                    console.log(err);
                } else {
                    console.log("sent uid mail");
                    res.render("success/fuidsuccess");
                }
            });
        } else {
            res.render("errors/usernx");
        }
    })
});


app.get("/forgotpass" , function(req,res){
    res.render("forgotpass");
});
let otp;
let forUser;
app.post("/forgotpass" , async function(req,res){
    forUser = req.body.email;
    otp = Math.floor(1000 + Math.random() * 9000).toString();
    User.findOne({email : forUser} , async function(err, foundUser){
        if(foundUser!=null){
            var body = `Dear ${foundUser.name},\n \nYour OTP to reset your password is ${otp}.\n \nRegards,\nAdmin\nGameSwitch LLC`
            let mailTransporter = await nodemailer.createTransport({
                service : "gmail",
                auth : {
                    user : process.env.MAIL_ID,
                    pass : process.env.MAIL_PASS
                },
                tls:{
                    rejectUnauthorized:false
                }
            });
            
        
            let details = {
                from : process.env.MAIL_ID,
                to : forUser,
                subject : "Reset Password",
                text : body
                }
        
            await mailTransporter.sendMail(details , function(err){
                if(err){
                    console.log(err);
                } else {
                    console.log("sent otp mail");
                    res.render("resetpass");
                }
            });
        } else {
            res.render("errors/usernx");
        }
    });
});

app.post("/resetpass" , function(req,res){
    var sOtp = otp;
    User.findOne({email : forUser} , function(err , foundUser){
        if (!err){
            if (sOtp === req.body.otp){
                foundUser.setPassword(req.body.newpass , function(){
                    foundUser.save();
                    otp = null;
                    res.render("success/passsuccess");
                });
            } else {
                res.render("errors/wrongotp");
            }
        } else {
            console.log(err);
        }
    });
});

app.get("/changepass" , function(req,res){
    if (req.isAuthenticated()){
        res.render("changepass");
    } else {
        res.redirect("/login");
    }
});

app.post("/changepass" , function(req,res){
    if (req.isAuthenticated()){
        const userID = req.user.username;
        User.findOne({username : userID} , function(err,foundUser){
            foundUser.changePassword(req.body.currentpass , req.body.newpass , function(err){
                if(!err){
                    req.logout(function(err){});
                    res.render("success/passsuccess");
                } else {
                    console.log(err);
                }
            });
        });
    }
});

app.get("/profile" , function(req,res){
    if (req.isAuthenticated()){
        var id = req.user.username;
        User.findOne({username : id} , function(err,foundUser){
            if (!err){
                res.render("profile" , {user : foundUser});
            } else {
                console.log(err);
            }
        });
    } else {
        res.redirect("/login");
    }
});

app.get("/orders" , function(req,res){
    if (req.isAuthenticated()){
        var id = req.user.username;
        Order.find({orderBy : id} , function(err,foundOrders){
            if (err){
                console.log(err);
            } else {
                res.render("orders" , {orders : foundOrders});
            }
        });
    } else {
        res.redirect("/login");
    }
});

app.post("/download-invoice" , function(req,res){
    Order.findOne({orderID : req.body.orderID} , function(err , foundOrder){
        if (!err){
            res.render("downinvoice" , {foundOrder : foundOrder});
        } else {
            console.log(err);
        }
    });
});

app.get("/lgsuccess" , function(req,res){
    res.render("success/loginsuccess");
});

app.get("/successhome" , function(req,res){
    if (req.isAuthenticated()){
        var a = true;
    } else {
        var a = false;
    }
    GameList.find({} , function(err , lol){
        if (err){
            console.log(err);
        } else {
            res.render("success/successhome" , {foundGames : lol , auth : a})
        }
    });
});

app.get("/badcred" , function(req,res){
    res.render("errors/badcred");
});

app.post("/login", passport.authenticate("local",{
    successRedirect: "/successhome",
    failureRedirect: "/badcred"
  }), function(req, res){
});

app.post("/register" , function(req,res){
    User.register({username : req.body.username , name : req.body.name , email : req.body.email} , req.body.password , function(err,user){
        if (err){
            console.log(err);
        } else {
            passport.authenticate("local")(req,res, function(){
                res.redirect("/");
            });
        }
    });
});

app.post("/gameadd" , function(req,res){
    console.log(req.body.name);
    const newGame = new GameList ({
        gameName : req.body.name,
        gamePrice : req.body.price,
        gameCover : req.body.imglink
    });

    newGame.save(function(){
        console.log("Success");
    });
    
    
});

app.get("/cart" , function(req,res){
    if (req.isAuthenticated()){
        const user = req.user.username;
        CartItem.find({userCart : user} , function(err,foundCartItems){
            var cartValue = 0;
            foundCartItems.forEach(function(item){
            cartValue = cartValue + Number(item.price);
            });
            res.render("cart" , {foundCartItems : foundCartItems , totalCartValue : cartValue , user : user});
        });
    } else {
        res.redirect("/login");
    }
});

app.post("/addtocart" , function(req,res){
    if (req.isAuthenticated()){
        var user = req.user.username;
        var gotID = req.body.hue;
        
        GameList.findOne({_id : gotID} , function(err , gotItem){
            CartItem.findOne({userCart : user , name : gotItem.gameName} , function(err , item){
                if (item === null) {
                    const newItem = new CartItem({
                        userCart : user,
                        name : gotItem.gameName,
                        price : gotItem.gamePrice,
                        coverPic : gotItem.gameCover
                    });
                    newItem.save(function(err){
                        if (!err){
                            console.log("Added to cart");
                        } else{
                            console.log("Already added to cart")
                        }
                    });
                } else {
                    console.log("already found");
                }
            });
        });
    } else {
        res.redirect("/login");
    }
});

app.post("/clearcart" , function(req,res){
    CartItem.deleteMany({userCart : req.body.username} , function(err){
        if (err){
            console.log(err);
        } else {
            console.log("yes");
        }
    });
});

app.post("/deletecartitem" , function(req,res){
    CartItem.findOneAndDelete({_id : req.body.item} , function(err){
        if (!err){
            console.log();
        } else {
            console.log(err);
        }
    });
});

let amount;
let secureEmail;
let custname;
let userid;
app.post("/checkout" , async (req,res) =>{
    if (req.isAuthenticated()){
        userid = req.user.username;
        secureEmail = req.user.email;
        custname = req.user.name;
        const YOUR_DOMAIN = "http://gameswitch-l9xs.onrender.com";
        amount = req.body.totalAmount;
        const amountToCharge = parseInt(amount * 100);
        const session = await stripe.checkout.sessions.create({
            line_items: [
              {
                price_data: {
                    unit_amount : amountToCharge,
                    currency : 'inr',
                    product : 'prod_NQ88GQKbVXo290'
                },
                quantity: 1,
              },
            ],
            mode: 'payment',
            success_url: `${YOUR_DOMAIN}/successorder`,
            cancel_url: `${YOUR_DOMAIN}/orderfailure`,
        });
        res.redirect(303, session.url);

    } else {
        res.redirect("/login");
    }    
});

app.get("/orderfailure" , function(req,res){
    res.render("orderfailure");
});

app.get("/successorder" , async function(req,res){
    if (req.isAuthenticated()){
        var todayDate = new Date().toISOString().slice(0, 10);
        const uName = req.user.name;
        const uEmail = req.user.email;

        CartItem.deleteMany({userCart : userid} , function(err){
            if (err){
                console.log(err);
            } else {
                console.log("yes");
            }
        });
        rndomNo = Math.floor(1000 + Math.random() * 9000).toString();
        const newOrder = new Order({
            orderBy : userid,
            custName : uName,
            custEmail : uEmail,
            orderDate : todayDate,
            orderID : rndomNo,
            amount : amount,
            status : "Paid"
        });   

        await newOrder.save();
        var body = `Dear ${custname},\n \nYour Payment of Rs ${amount} was succesful towards your order number #${rndomNo} you will shortly recieve an email containing the game codes. \n \nRegards,\nSales Team\nGameSwitch LLC`
        let mailTransporter = nodemailer.createTransport({
            service : "gmail",
            auth : {
                user : process.env.MAIL_ID,
                pass : process.env.MAIL_PASS
            },
            tls:{
                rejectUnauthorized:false
            }
        });
        
    
        let details = await {
            from : process.env.MAIL_ID,
            to : secureEmail,
            subject : "Order Confirmation",
            text : body
            }
    
        await mailTransporter.sendMail(details , function(err){
            if(err){
                console.log(err);
            } else {
                console.log("sent mail");
                res.render("ordersuccess" , {uName : uName , uEmail : uEmail , orderNo : rndomNo , price : amount});
            }
        });
    } else {
        res.redirect("/login");
    }
});

///////////////////////////////////////////

app.get("/search" , function(req,res){
   res.render("search");
});

app.post("/searchquery" , function(req,res){
    if (req.isAuthenticated()){
        var a = true;
    } else {
        var a = false;
    }
    let b;
    var regex = new RegExp(req.body.search , "i");
    GameList.find({gameName : regex} , function(err , foundS){
        if (!foundS.length){
            b = false;
        } else {
            b = true
        }
        res.render("searchquery" , {foundGames : foundS , auth :a , hot :b});

    });
});





connectDB().then(() => {
    console.log("DB CONNETED SUCCESFULLY");
    app.listen(3000, () => {
        console.log("Server STARTED");
    })
});
