if (process.env.NODE_ENV !== "production") {
  require('dotenv').config();
}

const express = require('express')
const port = process.env.PORT || 3000
const ejs = require('ejs')
const path = require('path')
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override')
const flash = require("connect-flash")
const session = require("express-session")
const passport = require('passport');
const LocalStrategy = require('passport-local');
const nodemailer = require('nodemailer')
const multer = require('multer')
const MongoDBStore = require('connect-mongo')(session);
const randomstring = require('randomstring')

const { cloudinary } = require("./cloudinary");
const { storage } = require("./cloudinary");
const upload = multer({storage})
const ExpressError = require('./utils/ExpressError');
const catchAsync = require('./utils/catchAsync');
const Giveaway = require('./models/giveaway.js')
const Lookingfor = require('./models/lookingfor')
const Review = require("./models/review.js")
const User = require("./models/user.js")

// getting-started.js
const mongoose = require('mongoose');

main().catch(err => console.log(err));

async function main() {
  await mongoose.connect(process.env.MONGO_URI)
  // use `await mongoose.connect('mongodb://user:password@127.0.0.1:27017/test');` if your database has auth enabled
}

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("we're connected!")
});

const app = express()

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')))

const store = new MongoDBStore({
  url:process.env.MONGO_URI,
  secret:process.env.SESSION_SECRET,
  touchAfter:24*60*60
})

store.on("error",function(e){
  console.log("Session-Store-Error",e)
})

const sessionConfig = {
  store,
  name:'session',
  secret:process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
      httpOnly: true,
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
      maxAge: 1000 * 60 * 60 * 24 * 7
  }
}

app.use(session(sessionConfig))
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
})

const isLoggedIn = (req,res,next)=>{
  if(!req.isAuthenticated()){
    req.flash('error','You must be Logged In')
     return res.redirect('/index/login')
  }
  next()
}

const isLoggedOut = (req,res,next)=>{
  if(req.isAuthenticated()){
    req.flash('error','You must be Logged Out')
     return res.redirect('/index')
  }
  next()
}

const isGiveawayAuthor = async(req,res,next)=>{
  const giveaway =await Giveaway.findById(req.params.id)
  if(!giveaway.author.equals(req.user._id)){
     req.flash('error','You dont own that profile')
     return res.redirect(`/index/${req.params.id}`)
  }
  next();
}

const isLookingforAuthor = async(req,res,next)=>{
  const lookingfor =await Lookingfor.findById(req.params.id)
  if(!lookingfor.author.equals(req.user._id)){
     req.flash('error','You dont own that profile')
     return res.redirect(`/index/${req.params.id}`)
  }
  next();
}

const isReviewAuthor = async (req, res, next) => {
  const { id, reviewId } = req.params;
  const review = await Review.findById(reviewId);
  if (!review.author.equals(req.user._id)) {
      req.flash('error', 'You do not have permission to do that!');
      return res.redirect(`/index/${id}`);
  }
  next();
} 

const isVerified = async(req,res,next)=>{
  if(req.user.isVerified != 1){
    req.flash('error', 'Your Email ID must be verified to do that.');
    return res.redirect('/index')
  }
  next();
}

//for sending mail
const sendVerificationMail = async(email,username,_id)=>{
    const transporter = nodemailer.createTransport({
      host:'smtp.gmail.com',
      port:587,
      secure:false,
      requireTLS:true,
      auth:{
        user:process.env.NODEMAILER_MAIL,
        pass:process.env.NODEMAILER_PASSWORD
      }
    })
    const mailOptions={
        from:process.env.NODEMAILER_MAIL,
        to:email,
        subject:'Give Away Verification Mail',
        html:`<p>Hi ${username}, please click on the link to <a href = "giveaway.cyclic.app/index/verify?id=${_id}">Verify</a></p>`
    }
    transporter.sendMail(mailOptions,function(error,info){
      if(error){
        console.log(error)
      }
      else{
        console.log('Email has been sent',info.response)
      }
    })
}
//send Reset password mail
const sendResetPasswordMail = async(email,username,token)=>{
  const transporter = nodemailer.createTransport({
    host:'smtp.gmail.com',
    port:587,
    secure:false,
    requireTLS:true,
    auth:{
      user:process.env.NODEMAILER_MAIL,
      pass:process.env.NODEMAILER_PASSWORD
    }
  })
  const mailOptions={
      from:process.env.NODEMAILER_MAIL,
      to:email,
      subject:'Give Away Reset Password',
      html:`<p>Hi ${username}, please click on the link to <a href = "giveaway.cyclic.app/index/resetPassword?token=${token}">Reset Password</a></p>`
  }
  transporter.sendMail(mailOptions,function(error,info){
    if(error){
      console.log(error)
    }
    else{
      console.log('Email has been sent',info.response)
    }
  })
}

app.get('/index', catchAsync(async(req,res,next)=>{
    const giveaways =  await Giveaway.find({})
    const lookingfors = await Lookingfor.find({})
    res.render('adds/index.ejs',{giveaways,lookingfors})
}))

app.get('/index/search',catchAsync(async(req,res,next)=>{
  var adds = req.query.category;
  var location = req.query.location;
  var giveaways = [];
  var lookingfors = [];
  if(!location){
    giveaways = await Giveaway.find({productName:{ $regex: adds,$options:'i' }}) 
    lookingfors = await Lookingfor.find({productName:{ $regex: adds,$options:'i' }})
  }
  else if(!adds){
    giveaways = await Giveaway.find({city:{ $regex: location,$options:'i' }}) 
    lookingfors = await Lookingfor.find({city:{ $regex: location,$options:'i' }})
  }
  else{
  giveaways = await Giveaway.find({$and:[{productName:{ $regex: adds,$options:'i' }},{city:{ $regex: location,$options:'i' }}]}) 
  lookingfors = await Lookingfor.find({$and:[{productName:{ $regex: adds,$options:'i' }},{city:{ $regex: location,$options:'i' }}]})
  }
  res.render('adds/search.ejs',{giveaways,lookingfors})
}))

app.get('/index/myAdds',isLoggedIn,isVerified,catchAsync(async(req,res,next)=>{
  const giveaways =  await Giveaway.find({}).populate('author')
  const lookingfors = await Lookingfor.find({}).populate('author')
  res.render('adds/myadds.ejs',{giveaways,lookingfors})
}))

app.get('/index/profile',isLoggedIn,isVerified,catchAsync(async(req,res,next)=>{
  const currentUser = await User.findById(req.user._id)
  res.render('users/friends.ejs',{currentUser})
}))

app.get('/index/newGiveaway',isLoggedIn,isVerified,async(req,res)=>{
  res.render('adds/newGiveaway.ejs')
})

app.post('/index/newGiveaway',isLoggedIn,isVerified,upload.single('giveaway[image]'),catchAsync(async(req,res,next)=>{
  const lookingfor = new Lookingfor(req.body.giveaway)
  lookingfor.image.url = req.file.path
  lookingfor.image.filename = req.file.filename
  lookingfor.author = req.user._id
  await lookingfor.save();
  res.redirect(`/index/lookingfor/${lookingfor._id}`)
}))

app.get('/index/newLookingFor',isLoggedIn,isVerified,async(req,res)=>{
  res.render('adds/newLookingFor.ejs')
})

app.post('/index/newLookingFor',isLoggedIn,isVerified,upload.single('lookingfor[image]'),catchAsync(async(req,res,next)=>{
  const giveaway = new Giveaway(req.body.lookingfor)
  giveaway.image.url = req.file.path
  giveaway.image.filename = req.file.filename
  giveaway.author = req.user._id
  await giveaway.save()
  res.redirect(`/index/giveaway/${giveaway._id}`)
}))

app.get("/index/register",(req,res)=>{
  res.render("users/register.ejs")
})

app.post("/index/register",catchAsync(async(req,res,next)=>{
  const {username,password,email} = req.body
  const user =new User({username,email})
  try{
  const registeredUser = await User.register(user,password)
  req.logIn(registeredUser,err=>{
    if (err){ 
       return next(err);
    }
    sendVerificationMail(req.body.email,req.body.username,user._id)
    req.flash('success', 'Your registration is done, please verify your Email ID to continue')
    setTimeout(()=>res.redirect('/index/register'),15000)
  })}catch(error){
    req.flash("error","Your email ID or username is already used.")
    res.redirect('/index/register');
  }
}))

app.get('/index/verify',catchAsync(async(req,res,next)=>{
  const {id} = req.query
  await User.findByIdAndUpdate(id,{$set:{isVerified:1}})
  res.redirect('/index')
}))

app.get('/index/login',(req,res)=>{
  res.render('users/login.ejs')
})

app.post('/index/login',
  passport.authenticate('local', { failureRedirect: '/index/login', failureFlash: true }),
  function(req, res) {
    req.flash('success','welcome back')
    res.redirect('/index');
  });

  app.get('/index/forgotPassword',isLoggedOut,catchAsync(async(req,res,next)=>{
    res.render('users/forgot.ejs');
  }))

  app.post('/index/forgotPassword',isLoggedOut,catchAsync(async(req,res,next)=>{
    const user = await User.findOne({email:req.body.email})
    if(!user){
      req.flash("error",'No user with such Email ID exists')
      return res.redirect('/index/forgotPassword')
    }
    if(user.isVerified != 1){
      req.flash("error",'Your Email Id is not Verified')
      return res.redirect('/index/forgotPassword')
    }
    const randomString= randomstring.generate()
    await user.updateOne({$set:{token:randomString}})
    sendResetPasswordMail(user.email,user.username,randomString)
    req.flash("success",'Please check your Email')
    setTimeout(()=>res.redirect('/index/forgotPassword'),15000)
  }))

app.get('/index/resetPassword',isLoggedOut,catchAsync(async(req,res,next)=>{
  const token = req.query.token
  const user= await User.findOne({token:token})
  if(!user || user.token == ''){
    req.flash("error",'Invalid Token')
    return res.redirect('/index/forgotPassword')
  }
  res.render('users/resetPassword.ejs',{user})
}))

app.get('/index/logout',(req,res)=>{
  req.logout(function(err) {
    if (err) { return next(err); }
    req.flash('success', "Goodbye!");
    res.redirect('/index');
  });  
})

app.post('/index/resetPassword/:id',isLoggedOut,catchAsync(async(req,res,next)=>{
  const password = req.body.password
  const user=await User.findByIdAndUpdate(req.params.id,{token:''})
  User.findById(req.params.id).then(function(sanitizedUser){
    if (sanitizedUser){
        sanitizedUser.setPassword(password, function(){
            sanitizedUser.save();
            req.flash('success', "Password Updated Successfully!");
            res.redirect('/index/login');
        });
    } else {
      req.flash("error",'This User does not exists')
      return res.redirect('/index/login')
    }
  },function(err){
    console.error(err);
  })
}))

app.get('/index/giveaway/:id',catchAsync(async(req,res,next)=>{
  const {id} =req.params
  const giveaway = await Giveaway.findById(id).populate('reviews').populate('author')
  const user = await User.findById({_id:giveaway.author._id}).populate('reviews')
  res.render('adds/showGiveaway.ejs',{giveaway,user})
}))

app.get('/index/lookingfor/:id',catchAsync(async(req,res,next)=>{
  const {id} =req.params
  const lookingfor =await Lookingfor.findById(id).populate('reviews').populate('author')
  const user = await User.findById({_id:lookingfor.author._id}).populate('reviews')
  res.render('adds/showLookingFor.ejs',{lookingfor,user})
}))

app.delete("/index/giveaway/:id/delete",isLoggedIn,isVerified,isGiveawayAuthor,catchAsync(async(req,res,next)=>{
  const {id} = req.params;
  const giveaway = await Giveaway.findById(id)
  await cloudinary.uploader.destroy(giveaway.image.filename);
  const giveaway1 = await Giveaway.findByIdAndDelete(id)
  res.redirect("/index")
}))

app.delete("/index/lookingfor/:id/delete",isLoggedIn,isVerified,isLookingforAuthor,catchAsync(async(req,res,next)=>{
  const {id} =  req.params;
  const lookingfor = await Lookingfor.findByIdAndDelete(id);
  await cloudinary.uploader.destroy(lookingfor.image.filename);
  res.redirect("/index")
}))

app.post('/index/giveaway/:id/reviews',isLoggedIn,isVerified,catchAsync(async(req,res,next)=>{
  console.log(req.user.username)
    const {id} = req.params;
    const giveaway = await Giveaway.findById(id).populate('author','_id');
    const review = new Review(req.body.review)
    const user = await User.findById({_id:giveaway.author._id})
    giveaway.reviews.push(review);
    user.reviews.push(review)
    review.author = req.user._id
    await review.save();
    await giveaway.save();
    await user.save();
  res.redirect(`/index/giveaway/${giveaway._id}`)
}))

app.post('/index/lookingfor/:id/reviews',isLoggedIn,isVerified,catchAsync(async(req,res,next)=>{
    const lookingfor = await Lookingfor.findById(req.params.id).populate('author','_id');
    const review = new Review(req.body.review)
    const user = await User.findById({_id:lookingfor.author._id})
    user.reviews.push(review)
    lookingfor.reviews.push(review);
    review.author = req.user._id
    await review.save();
    await lookingfor.save();
    await user.save()
  res.redirect(`/index/lookingfor/${lookingfor._id}`)
}))

app.delete('/index/giveaway/:id/reviews/:reviewId',isLoggedIn,isReviewAuthor,isVerified,catchAsync(async(req,res,next)=>{
  const {id,reviewId}= req.params;
  const giveaway=await Giveaway.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await User.findByIdAndUpdate({_id:giveaway.author._id},{ $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId)
  res.redirect(`/index/giveaway/${id}`)
}))

app.delete('/index/lookingfor/:id/reviews/:reviewId',isLoggedIn,isReviewAuthor,isVerified,catchAsync(async(req,res,next)=>{
  const {id,reviewId}= req.params;
  const lookingfor=await Lookingfor.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await User.findByIdAndUpdate({_id:lookingfor.author._id},{ $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId)
  res.redirect(`/index/lookingfor/${id}`)
}))

app.post("/index/giveaway/:id/sendReq",isLoggedIn,isVerified,catchAsync(async(req,res)=>{
  const add = await Giveaway.findById(req.params.id).populate('author')
  const reciever = await User.findById(add.author._id)
  const sender = await User.findById(req.user._id)

  for(let requested of sender.sentRequest){
    if(requested.username == reciever.username){
        req.flash('error','Already sent request to the user.')
    return res.redirect(`/index/giveaway/${add._id}`)
    }
  }

  for(let requested of sender.friendsList){
    if(requested.friendName == reciever.username){
        req.flash('error','You already have access to their contact details.')
    return res.redirect(`/index/giveaway/${add._id}`)
    }
  }
  
  for(let requested of reciever.sentRequest){
    if(requested.username == sender.username){
      req.flash('error','User has sent request to you.')
  return res.redirect(`/index/giveaway/${add._id}`)
  }
  }

  if(reciever.username == sender.username){
    req.flash('error','Cant send request to yourself.')
    return res.redirect(`/index/giveaway/${add._id}`)
  }

  reciever.request.push({userId:sender._id,username:sender.username})
  sender.sentRequest.push({username:reciever.username})
  await reciever.save()
  await sender.save()
  req.flash("success",'Request sent')
  res.redirect(`/index/giveaway/${add._id}`)
}))

app.post("/index/lookingfor/:id/sendReq",isLoggedIn,isVerified,catchAsync(async(req,res)=>{
  const add = await Lookingfor.findById(req.params.id).populate('author')
  const reciever = await User.findById(add.author._id)
  const sender = await User.findById(req.user._id)

  for(let requested of sender.sentRequest){
    if(requested.username == reciever.username){
        req.flash('error','Already sent request to the user.')
    return res.redirect(`/index/lookingfor/${add._id}`)
    }
  }
  
  for(let requested of reciever.sentRequest){
    if(requested.username == sender.username){
      req.flash('error','User has sent request to you.')
  return res.redirect(`/index/lookingfor/${add._id}`)
  }
  }

  for(let requested of sender.friendsList){
    if(requested.friendName == reciever.username){
        req.flash('error','You already have access to their contact details.')
    return res.redirect(`/index/lookingfor/${add._id}`)
    }
  }

  if(reciever.username == sender.username){
    req.flash('error','Cant send request to yourself.')
    return res.redirect(`/index/lookingfor/${add._id}`)
  }

  reciever.request.push({userId:sender._id,username:sender.username})
  sender.sentRequest.push({username:reciever.username})
  await reciever.save()
  await sender.save()
  req.flash("success",'Request sent')
  res.redirect(`/index/lookingfor/${add._id}`)
}))

app.post('/index/:id/acceptReq',isLoggedIn,isVerified,catchAsync(async(req,res,next)=>{
  const accepterName = req.user.username
  const sender = await User.findByIdAndUpdate(req.params.id,{ $pull: { sentRequest:{username:accepterName.toString()}} })
  const accepter = await User.findByIdAndUpdate(req.user._id,{ $pull: { request:{userId:sender._id} } })
  sender.friendsList.push({friendId:accepter._id,friendName:accepter.username})
  accepter.friendsList.push({friendId:sender._id,friendName:sender.username})
  await sender.save()
  await accepter.save();
  req.flash("success",'Request Accepted')
  res.redirect('/index/profile')
}))

app.post('/index/:username/cancelReq',isLoggedIn,isVerified,catchAsync(async(req,res,next)=>{
  const reqReciever =  await User.findOneAndUpdate({username:req.params.username},{ $pull: { request:{userId:req.user._id} } })
  const sender = await User.findByIdAndUpdate(req.user._id,{$pull:{sentRequest:{username:reqReciever.username}}})
  res.redirect('/index/profile')
}))

app.post('/index/:id/deleteReq',isLoggedIn,isVerified,catchAsync(async(req,res,next)=>{
  const accepterName = req.user.username
  const sender = await User.findByIdAndUpdate(req.params.id,{ $pull: { sentRequest:{username:accepterName.toString()}} })
  const accepter = await User.findByIdAndUpdate(req.user._id,{ $pull: { request:{userId:sender._id} } })
  res.redirect('/index/profile')
}))

app.post('/index/:id/removeFriend',isLoggedIn,isVerified,catchAsync(async(req,res,next)=>{
  const friend = await User.findById(req.params.id)
  await User.findByIdAndUpdate(req.user._id,{ $pull: { friendsList:{friendId:friend._id} } })
  await User.findByIdAndUpdate(friend._id,{ $pull: { friendsList:{friendId:req.user._id} } })
  res.redirect('/index/profile')
}))

app.get('/index/:UserName/UserReviews',isLoggedIn,isVerified,catchAsync(async(req,res,next)=>{
  const username = req.params.UserName
  console.log(req.params)
  const user = await User.findOne({username:username}).populate('reviews')
  console.log(user)
  const reviews = user.reviews
  res.render('users/userReviews',{reviews})
}))

app.all('*', (req, res, next) => {
  next(new ExpressError('Page Not Found', 404))
})

app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = 'Oh No, Something Went Wrong!'
  res.status(statusCode).render('error', { err })
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })