
const { Db } = require('mongodb');
var mongoose = require('mongoose');
var plm = require('passport-local-mongoose');

const URI ='mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/';


mongoose.connect(URI)
.then(function(){
  console.log("Connected to DB");
});

var userSchema = mongoose.Schema({
  username: String,
  email: String,
  password: String
});

userSchema.plugin(plm, { usernameField: "email" });
module.exports = mongoose.model("user", userSchema);