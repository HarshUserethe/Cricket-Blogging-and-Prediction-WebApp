var express = require('express');
var router = express.Router();
var axios =require('axios');
const cron = require('node-cron');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const cheerio = require('cheerio');
var userModel = require('./users');
const passport = require('passport');
const localStrategy = require("passport-local");
var bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path'); 

//mogodb connection
const uri = "mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/";
const client = new MongoClient(uri);

router.use(express.urlencoded({ extended: true }));
router.use(bodyParser.json());

 

const url = 'https://www.cricbuzz.com/cricket-match/live-scores';
const espnURL = 'https://www.espncricinfo.com/live-cricket-score?quick_class_id=domestic,t20';

async function scrapeRecentData() {
  const urlw = 'https://www.cricbuzz.com/cricket-match/live-scores/recent-matches';

  try {
    const response = await axios.get(urlw);
    const $ = cheerio.load(response.data);

    const matches = [];

    $('.cb-col-100.cb-col.cb-schdl').each((index, element) => {
      const matchElement = $(element);

      const team1 = matchElement.find('.cb-hmscg-tm-nm').eq(0).text().trim();
      const team2 = matchElement.find('.cb-hmscg-tm-nm').eq(1).text().trim();

      const scores = matchElement.find('.cb-ovr-flo');
      const team1Score = scores.eq(0).text().trim();
      const team2Score = scores.eq(2).text().trim(); // Corrected index for team 2 score

      const result = matchElement.find('.cb-text-complete').text().trim();

      const scorecardLink = $('nav.cb-col-100.cb-col.padt5 a:nth-child(2)').attr('href') || '';

      const matchLink = matchElement.find('.cb-lv-scrs-well-complete').attr('href') || '';
      const matchNumberIndex = matchLink.lastIndexOf('-');
      const matchNumber = matchNumberIndex !== -1 ? matchLink.substring(matchNumberIndex + 1) : '';

      const date = new Date(matchNumber); // Assuming the match number contains the date

      const matchData = {
        team1,
        team2,
        team1Score,
        team2Score,
        result,
        scorecardLink, // Ensure scorecard link is included
        matchNumber,
        date
      };

      matches.push(matchData);
    });

    return matches;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Function to scrape data from span tags within elements with class mr-2
async function scrapeData(url, fetchHTML) {
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);

  const cricketMatches = [];

  $('.cb-lv-scrs-well').each((index, element) => {
    const matchData = {};
    const $match = $(element);

    const data = $match.find('.cb-hmscg-bat-txt').text().trim();
    const bowl = $match.find('.cb-hmscg-bwl-txt').text().trim();
    const status = $match.find('.cb-text-live').text().trim();
    const scoreCard = $match.attr('href').trim();

    // Check if all required data fields are available
    if (data && bowl && status && scoreCard) {
      matchData.data = data;
      matchData.bowl = bowl;
      matchData.status = status;
      matchData.scoreCard = scoreCard;

      cricketMatches.push(matchData);
    }
  });

  return cricketMatches;
}


// Define API endpoint
router.get('/api/cricket', async (req, res) => {
  try {
    const cricketData = await scrapeData(url, fetchHTML);
    res.json(cricketData);
  } catch (error) {
    console.error('Error scraping cricket data:', error);
    res.status(500).json({ error: 'Failed to fetch cricket data' });
  }
});

//connect mongoDB
const URI ='mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/';
mongoose.connect(URI)
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

/* LOCAL PASSPORT STRATEGY */
passport.use(
  new localStrategy(
    {
      usernameField: "email",
    },
    userModel.authenticate()
  )
);

//REGISTER USER -->
router.post("/register-user", function (req, res, next) {
  var usersRouter = new userModel({
    username: req.body.username,
    email: req.body.email
  });

  userModel.register(usersRouter, req.body.password).then(function (dets) {
    passport.authenticate("local")(req, res, function () {
      res.redirect("/");
    });
  });
});




/* LOGIN ROUTE */
router.post(
  "/signin",
  passport.authenticate("local", {
    successRedirect: "/prediction",
    failureRedirect: "/login",
    failureFlash: true,
  }),
  function (req, res, next) {
    res.redirect("/login");
  }
);


/* LOGOUT ROUTE */
router.get("/logout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});


/* MIDDLEWARE */
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect("/login");
  }
}

router.get('/register', async(req, res) => {
  res.render('register')
})


//cb-view-all-ga

const apiDataSchema = new mongoose.Schema({
  page_number: Number,
  match_format: String,
  key: String,
  // Add more fields as needed based on the API response structure
});



//API ENDPOINTS METHODS TO STORE DATA IN DATABASE 

async function addUpcomingMatch() {
  const options = {
    method: 'POST',
    url: 'https://cricket.scoreswift.in/schedule/upcoming',
    headers: {
      "X-ScoreSwift-Key": "5o4$t-LPhA7i2ruStuDr_v5"
    },
    data: {
      page_number: 1,
      match_formate: ''
    }
  };

  try {
    const response = await axios.request(options);
    const dataToStore = response.data;

    // Connect to MongoDB Atlas
    const client = new MongoClient('mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/');
    await client.connect();

    const db = client.db('cricwwwdb'); // Specify your database name here
    const collection = db.collection('upcoming'); // Specify your collection name here

    // Check if there's already an object in the collection
    const existingObject = await collection.findOne({});
    
    if (existingObject) {
      // Update the existing object
      await collection.replaceOne({}, dataToStore);
    } else {
      // Insert the data into MongoDB
      await collection.insertOne(dataToStore);
    }

    client.close(); // Close the MongoDB connection

  } catch (error) {
    console.log(error);
  }
}

async function addAllT20Schedule(){
  const options = {
    method: 'POST',
    url: 'https://cricket.scoreswift.in/schedule/upcoming',
    headers: {
      "X-ScoreSwift-Key": "5o4$t-LPhA7i2ruStuDr_v5"
    },
    data: {
      "page_number": 2,
      "match_formate": ""
    }
  };

  try {
    const response = await axios.request(options);
    const dataToStore = response.data;

    // Connect to MongoDB Atlas
    const client = new MongoClient('mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/');
    await client.connect();

    const db = client.db('cricwwwdb'); // Specify your database name here
    const collection = db.collection('worldcup'); // Specify your collection name here

    // Check if there's already an object in the collection
    const existingObject = await collection.findOne({});
    
    if (existingObject) {
      // Update the existing object
      await collection.replaceOne({}, dataToStore);
    } else {
      // Insert the data into MongoDB
      await collection.insertOne(dataToStore);
    }

    client.close(); // Close the MongoDB connection

  } catch (error) {
    console.log(error);
  }
}


async function recentMatch(){
  const options = {
    method: 'POST',
    url: 'https://cricket.scoreswift.in/schedule/recent',
    headers: {
      "X-ScoreSwift-Key": "5o4$t-LPhA7i2ruStuDr_v5"
    },
    data: {
      page_number: 1,
      match_formate: ''
    }
  };

  try {
    const response = await axios.request(options);
    const dataToStore = response.data;

    // Connect to MongoDB Atlas
    const client = new MongoClient('mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/');
    await client.connect();

    const db = client.db('cricwwwdb'); // Specify your database name here
    const collection = db.collection('recentMatches'); // Specify your collection name here

    // Check if there's already an object in the collection
    const existingObject = await collection.findOne({});
    
    if (existingObject) {
      // Update the existing object
      await collection.replaceOne({}, dataToStore);
    } else {
      // Insert the data into MongoDB
      await collection.insertOne(dataToStore);
    }

    client.close(); // Close the MongoDB connection

  } catch (error) {
    console.log(error);
  }
}

async function mensBattingT20(){
  const options = {
    method: 'POST',
    url: 'https://cricket.scoreswift.in/ranking/men',
    headers: {
      "X-ScoreSwift-Key": "5o4$t-LPhA7i2ruStuDr_v5"
    },
    data: {
      match_formate: 't20',
      rank_type: 'bat'
    }
  };

  try {
    const response = await axios.request(options);
    const dataToStore = response.data;

    // Connect to MongoDB Atlas
    const client = new MongoClient('mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/');
    await client.connect();

    const db = client.db('cricwwwdb'); // Specify your database name here
    const collection = db.collection('mensBattingT20'); // Specify your collection name here

    // Check if there's already an object in the collection
    const existingObject = await collection.findOne({});
    
    if (existingObject) {
      // Update the existing object
      await collection.replaceOne({}, dataToStore);
    } else {
      // Insert the data into MongoDB
      await collection.insertOne(dataToStore);
    }

    client.close(); // Close the MongoDB connection

  } catch (error) {
    console.log(error);
  }
}

async function mensBattingODI(){
  const options = {
    method: 'POST',
    url: 'https://cricket.scoreswift.in/ranking/men',
    headers: {
      "X-ScoreSwift-Key": "5o4$t-LPhA7i2ruStuDr_v5"
    },
    data: {
      match_formate: 'odi',
      rank_type: 'bat'
    }
  };

  try {
    const response = await axios.request(options);
    const dataToStore = response.data;

    // Connect to MongoDB Atlas
    const client = new MongoClient('mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/');
    await client.connect();

    const db = client.db('cricwwwdb'); // Specify your database name here
    const collection = db.collection('mensBattingODI'); // Specify your collection name here

    // Check if there's already an object in the collection
    const existingObject = await collection.findOne({});
    
    if (existingObject) {
      // Update the existing object
      await collection.replaceOne({}, dataToStore);
    } else {
      // Insert the data into MongoDB
      await collection.insertOne(dataToStore);
    }

    client.close(); // Close the MongoDB connection

  } catch (error) {
    console.log(error);
  }
}

async function mensBattingTest(){
  const options = {
    method: 'POST',
    url: 'https://cricket.scoreswift.in/ranking/men',
    headers: {
      "X-ScoreSwift-Key": "5o4$t-LPhA7i2ruStuDr_v5"
    },
    data: {
      match_formate: 'test',
      rank_type: 'bat'
    }
  };

  try {
    const response = await axios.request(options);
    const dataToStore = response.data;

    // Connect to MongoDB Atlas
    const client = new MongoClient('mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/');
    await client.connect();

    const db = client.db('cricwwwdb'); // Specify your database name here
    const collection = db.collection('mensBattingTest'); // Specify your collection name here

    // Check if there's already an object in the collection
    const existingObject = await collection.findOne({});
    
    if (existingObject) {
      // Update the existing object
      await collection.replaceOne({}, dataToStore);
    } else {
      // Insert the data into MongoDB
      await collection.insertOne(dataToStore);
    }

    client.close(); // Close the MongoDB connection

  } catch (error) {
    console.log(error);
  }
}

async function mensTestTeam(){
  const options = {
    method: 'POST',
    url: 'https://cricket.scoreswift.in/ranking/men',
    headers: {
      "X-ScoreSwift-Key": "5o4$t-LPhA7i2ruStuDr_v5"
    },
    data: {
      match_formate: 'test',
      rank_type: 'team'
    }
  };

  try {
    const response = await axios.request(options);
    const dataToStore = response.data;

    // Connect to MongoDB Atlas
    const client = new MongoClient('mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/');
    await client.connect();

    const db = client.db('cricwwwdb'); // Specify your database name here
    const collection = db.collection('mensTestTeam'); // Specify your collection name here

    // Check if there's already an object in the collection
    const existingObject = await collection.findOne({});
    
    if (existingObject) {
      // Update the existing object
      await collection.replaceOne({}, dataToStore);
    } else {
      // Insert the data into MongoDB
      await collection.insertOne(dataToStore);
    }

    client.close(); // Close the MongoDB connection

  } catch (error) {
    console.log(error);
  }
}

async function mensT20Team(){
  const options = {
    method: 'POST',
    url: 'https://cricket.scoreswift.in/ranking/men',
    headers: {
      "X-ScoreSwift-Key": "5o4$t-LPhA7i2ruStuDr_v5"
    },
    data: {
      match_formate: 't20',
      rank_type: 'team'
    }
  };

  try {
    const response = await axios.request(options);
    const dataToStore = response.data;

    // Connect to MongoDB Atlas
    const client = new MongoClient('mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/');
    await client.connect();

    const db = client.db('cricwwwdb'); // Specify your database name here
    const collection = db.collection('mensT20Team'); // Specify your collection name here

    // Check if there's already an object in the collection
    const existingObject = await collection.findOne({});
    
    if (existingObject) {
      // Update the existing object
      await collection.replaceOne({}, dataToStore);
    } else {
      // Insert the data into MongoDB
      await collection.insertOne(dataToStore);
    }

    client.close(); // Close the MongoDB connection

  } catch (error) {
    console.log(error);
  }
}

async function mensODITeam(){
  const options = {
    method: 'POST',
    url: 'https://cricket.scoreswift.in/ranking/men',
    headers: {
      "X-ScoreSwift-Key": "5o4$t-LPhA7i2ruStuDr_v5"
    },
    data: {
      match_formate: 'odi',
      rank_type: 'team'
    }
  };

  try {
    const response = await axios.request(options);
    const dataToStore = response.data;

    // Connect to MongoDB Atlas
    const client = new MongoClient('mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/');
    await client.connect();

    const db = client.db('cricwwwdb'); // Specify your database name here
    const collection = db.collection('mensODITeam'); // Specify your collection name here

    // Check if there's already an object in the collection
    const existingObject = await collection.findOne({});
    
    if (existingObject) {
      // Update the existing object
      await collection.replaceOne({}, dataToStore);
    } else {
      // Insert the data into MongoDB
      await collection.insertOne(dataToStore);
    }

    client.close(); // Close the MongoDB connection

  } catch (error) {
    console.log(error);
  }
}

async function iplPointsTable(){
  const options = {
    method: 'POST',
    url: 'https://cricket.scoreswift.in/series/pointstable',
    headers: {
      "X-ScoreSwift-Key": "5o4$t-LPhA7i2ruStuDr_v5"
    },
    data: {
      key: "ipl_2024"
    }
  };

  try {
    const response = await axios.request(options);
    const dataToStore = response.data;

    // Connect to MongoDB Atlas
    const client = new MongoClient('mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/');
    await client.connect();

    const db = client.db('cricwwwdb'); // Specify your database name here
    const collection = db.collection('iplPointsTable'); // Specify your collection name here

    // Check if there's already an object in the collection
    const existingObject = await collection.findOne({});
    
    if (existingObject) {
      // Update the existing object
      await collection.replaceOne({}, dataToStore);
    } else {
      // Insert the data into MongoDB
      await collection.insertOne(dataToStore);
    }

    client.close(); // Close the MongoDB connection

  } catch (error) {
    console.log(error);
  }
}
async function fetchDataAndStore() {
  const pagesToFetch = [1, 2, 3, 4, 5, 6]; // Specify the page numbers you want to fetch

  // Initialize an empty array to store data from all pages
  let combinedData = [];

  // Iterate over each page and fetch data
  for (const pageNumber of pagesToFetch) {
    const options = {
      method: 'POST',
      url: 'https://cricket.scoreswift.in/schedule/recent',
      headers: {
        "X-ScoreSwift-Key": "5o4$t-LPhA7i2ruStuDr_v5"
      },
      data: {
        page_number: pageNumber,
        match_formate: ''
      }
    };

    try {
      const response = await axios.request(options);
      // console.log(`Fetched data from page ${pageNumber}:`, response.data); 
      combinedData.push(response.data);
    } catch (error) {
      console.log(`Error fetching data from page ${pageNumber}:`, error);
    }
  }

  // Connect to MongoDB Atlas
  const client = new MongoClient('mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/');
  try {
    await client.connect();

    const db = client.db('cricwwwdb');
    const collection = db.collection('lastPrediction');

    // Check if there's already data in the collection
    const existingData = await collection.findOne({});

    if (existingData) {
      // Update the existing data
      await collection.replaceOne({}, { lastPrediction: combinedData });
    } else {
      // Insert the combined data into MongoDB
      await collection.insertOne({ lastPrediction: combinedData });
    }

    console.log(existingData);
  } catch (error) {
    console.log("Error storing data in MongoDB:", error);
  } finally {
    client.close(); // Close the MongoDB connection
  }
}


//CRON JOB SCHEDULER
// Schedule the functions to run at 23:30 daily
cron.schedule('55 0 * * *', () => {
  addUpcomingMatch();
  addAllT20Schedule();
  recentMatch();
  mensBattingT20();
  mensBattingODI();
  mensBattingTest();
  mensODITeam();
  mensT20Team();
  mensTestTeam();
  iplPointsTable();
  fetchDataAndStore();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata" // Change this to your timezone
});

cron.schedule('30 19 * * 6-7', () => {
  addUpcomingMatch();
  addAllT20Schedule();
  recentMatch();
  mensBattingT20();
  mensBattingODI();
  mensBattingTest();
  mensODITeam();
  mensT20Team();
  mensTestTeam();
  iplPointsTable();
  fetchDataAndStore();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata" // Change this to your timezone
});

var apiKeys = ['88ce5ac1-d5e9-49fc-804a-856b6ca21140','27d09fba-0ba3-434b-b88a-729cc5743e4b', '0e32e845-c5b7-4fcf-9bb5-6a3fad78e2ff','26d8d848-84c6-4b2f-b335-703561ad17d1','bc12b328-160e-4cbd-b4c8-e2c223ddf5d7'];

var currentApiKeyIndex = 0;
var apiKeyUsage = apiKeys.map(() => 0);

async function getNextApiKey() {
 // Check if the current API key has reached its limit
 if (apiKeyUsage[currentApiKeyIndex] >= 90) { // Assuming a limit of 100 requests per API key
    // Move to the next API key, resetting the index if it exceeds the array length
    currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;
    // Reset the usage counter for the new API key
    apiKeyUsage[currentApiKeyIndex] = 0;
 }
 // Increment the usage counter for the current API key
 apiKeyUsage[currentApiKeyIndex]++;
 // Return the current API key
 return apiKeys[currentApiKeyIndex];
}

const { documentToHtmlString } = require('@contentful/rich-text-html-renderer');
// var startIndex = 0;
// var endIndex = 3;

// Initialize startIndex and endIndex per session
router.use((req, res, next) => {
  if (!req.session.startIndex) {
      req.session.startIndex = 0;
      req.session.endIndex = 3;
  }
  next();
});

// Middleware to reset values if inactive for 5 minutes
const resetIfInactive = (req, res, next) => {
  req.session.lastActivity = Date.now();
  if (req.session.startIndex !== 0 || req.session.endIndex !== 3) {
      const timeElapsed = Date.now() - req.session.lastActivity;
      if (timeElapsed > 300000) { // Check if inactive for more than 5 minutes
          req.session.startIndex = 0;
          req.session.endIndex = 3;
      }
  }
  next();
};



router.get('/login', async function(req, res){
  const user = req.user
  res.render('login', {user});
})

router.get('/test', function(req, res){
  res.render('test');
})


router.get('/', async function(req, res, next) {
  const user = await req.user;
  const startIndex = req.session.startIndex;
  const endIndex = req.session.endIndex;

  try {
    // Fetch data from external APIs in parallel
    const [liveScoreResponse, blogResponse] = await Promise.all([
      axios('https://cricwww.com/api/cricket'),
      axios('http://45.129.86.137:3000/api/posts?populate=*')
    ]);

    const liveScoreData = liveScoreResponse.data;
    const blogData = blogResponse.data;
    const postData = blogData.data;

    // Connect to MongoDB
    await client.connect();

    // Access the database and collection
    const database = client.db('cricwwwdb');
    const collection = database.collection('upcoming');

    // Fetch data from MongoDB
    const data = await collection.find({}).toArray();

    // Close the connection to the MongoDB server
    await client.close();

    const filteredFixture = data[0].res.matches;
    const filteredFixtureData = filteredFixture.filter(item => item.srsKey === 'ipl_2024');

    // Render the page with optimized data
    res.render('index', {postData, startIndex, endIndex, filteredFixtureData, liveScoreData, user});
  } catch (error) {
    res.status(500).send('Error: API daily limit exceeded. Please try again later.');
    console.error(error);
  }
});


router.get('/blog/:id', async (req, res) => {
  const user = req.user;
  const id = req.params.id
  const response = await axios(`http://45.129.86.137:3000/api/posts/${id}?populate=*`);
  const allResponse = await axios('http://45.129.86.137:3000/api/posts/?populate=*');
  const blogPostData = response.data;
  const singlePost = blogPostData.data;
  const Blog = allResponse.data;
  const recentBlog = Blog.data;
 const richText = singlePost.attributes.des;

  function jsonToHtml(jsonData) {
    let html = "";
  
    function processNode(node) {
      switch (node.type) {
        case "heading":
          html += `<h${node.level}>${processNode(node.children[0])}</h${node.level}>`;
          break;
        case "paragraph":
          html += `<p>${node.children.map(processNode).join("")}</p>`;
          break;
        case "list":
          const listType = node.format === "ordered" ? "ol" : "ul";
          html += `<${listType}>`;
          html += node.children.map(processNode).join("");
          html += `</${listType}>`;
          break;
        case "list-item":
          html += `<li>${processNode(node.children[0])}</li>`;
          break;
        case "text":
          let text = node.text;
          if (node.bold) {
            text = `<strong>${text}</strong>`;
          }
          if (node.italic) {
            text = `<i>${text}</i>`;
          }
          if (node.underline) {
            text = `<u>${text}</u>`;
          }
          if (node.strikethrough) {
            text = `<s>${text}</s>`;
          }
          return text;
        case "image":
          html += `<img style="width: 50vw;" src="${node.image.url}" alt="${node.image.alternativeText}" />`;
          break;
        case "quote":
          html += `<blockquote>${processNode(node.children[0])}</blockquote>`;
          break;
        case "link":
          html += `<a href="${node.url}">${processNode(node.children[0])}</a>`;
          break;
        default:
          break;
      }
    }
  
    jsonData.forEach(processNode);
    return html;
  }
  const jsonData = richText;
  const htmlContent = jsonToHtml(jsonData); 

  res.render('blog', {singlePost, recentBlog, htmlContent, user})
})

router.get('/test', async (req, res) => {
  const response = await axios('http://45.129.86.137:3000/api/posts/11?populate=*');
  const blogData = response.data;
  const postData =blogData.data;
  const data = postData.attributes.des;
 
  res.json(data)

})

router.get('/nextPage', resetIfInactive, async (req, res) => {
  const response = await axios('http://45.129.86.137:3000/api/posts?populate=*');
  const allPosts = response.data.data;

  if (req.session.endIndex < allPosts.length) {
      req.session.startIndex += 3;
      req.session.endIndex += 3;
  } else {
      req.session.startIndex = 0;
      req.session.endIndex = 3;
  }

  res.redirect('/');
});

router.get('/prevPage',resetIfInactive, async (req, res) => {
  const response = await axios('http://45.129.86.137:3000/api/posts?populate=*');
  const allPosts = response.data.data;

  if (req.session.startIndex > 0) {
      req.session.startIndex -= 3;
      req.session.endIndex -= 3;
  }

  res.redirect('/');
});


router.get('/ipl-matches', async (req, res) => {
 const response = await axios('https://api.cricapi.com/v1/currentMatches?apikey=88ce5ac1-d5e9-49fc-804a-856b6ca21140')
 res.json(response.data.data)
})

router.get('/fixture', async function(req, res) {
  try {
      const user = await req.user;
      // Connection URI for MongoDB
      const uri = "mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/";
      
       // Create a new MongoClient
       const client = new MongoClient(uri);
      
      // Connect to the MongoDB server
       await client.connect();
      
       // Access the database and collection
       const database = client.db('cricwwwdb');
       const collection = database.collection('upcoming');
       const wcupCollection = database.collection('worldcup');
       const recentMatchesCollection = database.collection('recentMatches');
      
      // Fetch data from MongoDB
      const data = await collection.find({}).toArray();
      const wcup = await wcupCollection.find({}).toArray();
      const recent = await recentMatchesCollection.find({}).toArray();
      
       // Close the connection to the MongoDB server
       await client.close();

       const filteredFixture = data[0].res.matches
       const filteredFixtureData = filteredFixture.filter(item => item.srsKey === 'ipl_2024');
       const mensWcup = wcup[0].res.matches;
       const worldCupMatches = mensWcup.filter(item => item.srsKey === "t20_wc_2024");
           
        const recentRecord = recent[0].res.matches;
        const recentMatches = recentRecord.filter(item => item.srsKey === "t20_wc_2024" || item.srsKey === 'ipl_2024');
       // Send the fetched data as JSON in the response
       const wpl =[];
       res.render('fixture', {recentMatches, worldCupMatches, filteredFixtureData, wpl, user})
   } catch (error) {
       console.error("Error fetching data from MongoDB:", error);
       res.status(500).json({ error: "Internal server error" });
   }
 });

//matchranking
router.get('/ranking', async function(req, res){
  const user = await req.user;
  // Connection URI for MongoDB
  const uri = "mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/";
      
  // Create a new MongoClient
  const client = new MongoClient(uri);
 
 // Connect to the MongoDB server
  await client.connect();
 
  // Access the database and collection
  const database = client.db('cricwwwdb');
  const mensBattingT20 = database.collection('mensBattingT20');
  const mensBattingODI = database.collection('mensBattingODI');
  const mensBattingTest = database.collection('mensBattingTest');
  const mensODITeam = database.collection('mensODITeam');
  const mensT20Team = database.collection('mensT20Team');
  const mensTestTeam = database.collection('mensTestTeam');


  //fetch data
  const batRankingx =  await mensBattingT20.find({}).toArray();
  const odiRankingx = await mensBattingODI.find({}).toArray();
  const testRankingx = await mensBattingTest.find({}).toArray();
  const oditeamRankingx = await mensODITeam.find({}).toArray();
  const t20teamRankingx = await mensT20Team.find({}).toArray();
  const testteamRankingx = await mensTestTeam.find({}).toArray();

  //main variable
  const batRanking = await batRankingx[0].data['bat-rank'].rank;
  const odiRanking = await odiRankingx[0].data['bat-rank'].rank;
  const testRanking = await testRankingx[0].data['bat-rank'].rank;
  const oditeamRanking = await oditeamRankingx[0].data['bat-rank'].rank;
  const t20teamRanking = await t20teamRankingx[0].data['bat-rank'].rank;
  const testteamRanking = await testteamRankingx[0].data['bat-rank'].rank;

  //adding data to variable
  res.render('stats', {batRanking, odiRanking, testRanking, oditeamRanking, t20teamRanking, testteamRanking, user})
 });

 router.get('/stats-corner', async function(req, res){
  const user = req.user;
   // Connection URI for MongoDB
   const uri = "mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/";
      
   // Create a new MongoClient
   const client = new MongoClient(uri);
  
  // Connect to the MongoDB server
   await client.connect();
  
   // Access the database and collection
   const database = client.db('cricwwwdb');
   const iplPointsTable = database.collection('iplPointsTable');
 
   //fetch data
   const iplPointsTablex =  await iplPointsTable.find({}).toArray();
  
   //main variable
   const iplPoints= await iplPointsTablex[0].res.series.points[0].teams;
   const wplPoints = []

   res.render('statscorner', {wplPoints, iplPoints, user})
 })


router.get('/match-table', async (req, res) => {
  const user = await req.user;
  // const allMatchResponse = await axios('https://api.cricapi.com/v1/cricScore?apikey=88ce5ac1-d5e9-49fc-804a-856b6ca21140');
  // const allMatch = allMatchResponse.data.data
  const options = {
    method: 'POST',
    url: ' https://cricket.scoreswift.in/schedule/upcoming',
    headers: {
      "X-ScoreSwift-Key": "5o4$t-LPhA7i2ruStuDr_v5"
    },
    data: {
      page_number: 1,
      match_formate: 'T20',
      key: 'ipl_2024'
    }
  };
const response = await axios.request(options);
const fixtureData = response.data.res.matches
const filteredFixtureData = fixtureData.filter((item) => item.srsKey === "ipl_2024");
  const matches = [];
  const ongoingMatches = await matches.filter(match => match.teams.includes("India") || match.series_id === "76ae85e2-88e5-4e99-83e4-5f352108aebc");
  // const ongoingMatches = await matches.filter(match => match.teams.includes("Ghana") || match.series_id === "fb93b3c0-1a69-4032-81fd-92f0f7b5019d");
  // if(ongoingMatches.length === 0){
  //   res.json({message: "no matches found"})
  // }else{
  //   res.json(ongoingMatches);
  // }
  res.render('matchlist', {ongoingMatches, matches, filteredFixtureData, user})
});



router.get('/predict-data/:page', async (req, res) => {
  // Connection URI for MongoDB
  const user = await req.user;
  const uri = "mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/";
  const page = req.params.page
  // Create a new MongoClient
  const client = new MongoClient(uri);

 // Connect to the MongoDB server
  await client.connect();

  // Access the database and collection
  const database = client.db('cricwwwdb');
  const collection = database.collection('lastPrediction');

  // Fetch data from MongoDB
  const data = await collection.find({}).toArray();

 // Close the connection to the MongoDB server
   await client.close();

   const recent = data[0].lastPrediction[`${page}`].res.matches
   // const recent = data[0].res.matches


const response = await axios('http://45.129.86.137:3000/api/comments');
const recentRecord = recent;
const recentMatches = recentRecord.filter(item => item.srsKey === "mens_t20_wc_2024" || item.srsKey === 'ipl_2024');
const comments = response.data.data;

res.render('pdata', {comments, recentMatches, user});

})

router.get('/predict-data',isLoggedIn, async (req, res) => {
  const user = req.user;
  // Connection URI for MongoDB
  const uri = "mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/";
     
  // Create a new MongoClient
  const client = new MongoClient(uri);
 
 // Connect to the MongoDB server
  await client.connect();
 
  // Access the database and collection
  const database = client.db('cricwwwdb');
  const collection = database.collection('recentMatches');

  // Fetch data from MongoDB
  const data = await collection.find({}).toArray();

  // Close the connection to the MongoDB server
   await client.close();

   const recent = data[0].res.matches


const response = await axios('http://45.129.86.137:3000/api/comments');
const recentRecord = recent;
const recentMatches = recentRecord.filter(item => item.srsKey === "mens_t20_wc_2024" || item.srsKey === 'ipl_2024');
const comments = response.data.data;

res.render('pdata', {comments, recentMatches, user});

})

router.get('/prediction', async function(req, res) {
  try {
     
     const user = req.user; // Assuming the authenticated user is stored in req.user
     console.log(user)
     // Connection URI for MongoDB
     const uri = "mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/";
      
     // Create a new MongoClient
     const client = new MongoClient(uri);
    
    // Connect to the MongoDB server
     await client.connect();
    
     // Access the database and collection
     const database = client.db('cricwwwdb');
     const collection = database.collection('upcoming');
     const predict = await axios('http://45.129.86.137:3000/api/comments');
     const predictData = predict.data.data;
     const recentMatchesCollection = database.collection('recentMatches');
   

      // Fetch data from MongoDB
      const data = await collection.find({}).toArray();
      const recent = await recentMatchesCollection.find({}).toArray();

      // Close the connection to the MongoDB server
       await client.close();

       const filteredFixture = data[0].res.matches
       const filteredFixtureData = filteredFixture.filter(item => item.srsKey === 'ipl_2024');

      const teamone = filteredFixtureData[0].teams.t1.sName;
      const teamtwo = filteredFixtureData[0].teams.t2.sName;


      //prediction data
  const prediction = await axios('http://45.129.86.137:3000/api/comments?populate=*')
  const pdata = prediction.data.data;
  //result of  match
  const recentRecord = recent[0].res.matches;

  //file system  of  ipl results 2024
   // Read data from local JSON file
   const filePath = path.join(__dirname, '../public/api/matchresults.json');
   const fsdata = fs.readFileSync(filePath, 'utf8');
   const jsonData = JSON.parse(fsdata);


      res.render('prediction', {filteredFixtureData, teamone, teamtwo, predictData, user, recentMatches:jsonData, pdata});
  } catch (error) {
    console.error("Error fetching data from MongoDB:", error);
    res.status(500).json({ error: "Internal server error" });
  }
 })


router.get('/mode', async function(req, res) {
  res.send(apiKeyUsage)
})

// -----------------IOS SECOND PAGE REPLICA --------------------------
router.get('/cric-home', async function(req, res, next) {
  const user = await req.user;
  const startIndex = req.session.startIndex;
  const endIndex = req.session.endIndex;
  const apiKey = await getNextApiKey();

 try {
    const iplMatch = await axios(`https://api.cricapi.com/v1/currentMatches?apikey=${apiKey}&offset=0`);
    const liveScore = await axios('https://cricwww.com/api/cricket');
    const liveScoreData = liveScore.data;
  
   
    var matches = await iplMatch.data.data;

    if(iplMatch.data.status === 'failure'){
      matches = [];
    }else{
     matches = await iplMatch.data.data;
    }

//-----------------------------------------------------------------------------------

// Connection URI for MongoDB
const uri = "mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/";
     
// Create a new MongoClient
const client = new MongoClient(uri);

// Connect to the MongoDB server
await client.connect();

// Access the database and collection
const database = client.db('cricwwwdb');
const collection = database.collection('upcoming');

// Fetch data from MongoDB
const data = await collection.find({}).toArray();

// Close the connection to the MongoDB server
await client.close();

const filteredFixture = data[0].res.matches
const filteredFixtureData = filteredFixture.filter(item => item.srsKey === 'ipl_2024');
    
//-----------------------------------------------------------------------------------


   
   //remove comment to show ipl matches ---->
    const ongoingMatches = await matches.filter(match => match.teams.includes("India") || match.series_id === "76ae85e2-88e5-4e99-83e4-5f352108aebc" || match.matchEnded === "false");
   //const ongoingMatches = await matches.filter(match => match.teams.includes("Ghana") || match.series_id === "fb93b3c0-1a69-4032-81fd-92f0f7b5019d");
   //const ongoingMatches = await matches.filter(match => match.fantasyEnabled === true || match.teams.includes("India") || match.series_id === "76ae85e2-88e5-4e99-83e4-5f352108aebc");
   
  
   const recentMatch =  await ongoingMatches.sort((a, b) => {
     const dateA = new Date(a.dateTimeGMT);
     const dateB = new Date(b.dateTimeGMT);

     return dateB - dateA; // Sort in descending order
 });
   
   const response = await axios('http://45.129.86.137:3000/api/posts?populate=*');
   const comments = await axios('http://45.129.86.137:3000/api/comments');
   const commentsReponse = comments.data.data;
   const blogData = response.data;
   const postData = blogData.data;

   //error handling --->
   if (postData.length === 0 && commentsReponse.length === 0) {
     return res.render('index', { postData: [], recentMatch: recentMatch, commentsReponse: [], startIndex: startIndex, endIndex: endIndex, user });
   }
   else if(postData.length === 0){
     return res.render('index', { postData: [], recentMatch: recentMatch, commentsReponse, startIndex: startIndex, endIndex: endIndex, user });
   }
   else if(commentsReponse.length === 0){
     return res.render('index', { postData, recentMatch: recentMatch, commentsReponse: [], startIndex: startIndex, endIndex: endIndex, user });
   }
   
   res.render('./replica/home', {postData, startIndex, endIndex, recentMatch, commentsReponse, filteredFixtureData, liveScoreData, user})
   // res.render('index', { blogData });
 } catch (error) {
   res.status(500).send('Error: API daily limit exceeded. Please try again later.'); // Or a more informative message
   console.error(error); // Handle errors gracefully (e.g., send an error page)
 }
});

router.get('/cric-fixture', async function(req, res) {
  try {
      const user = await req.user;
      // Connection URI for MongoDB
      const uri = "mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/";
      
       // Create a new MongoClient
       const client = new MongoClient(uri);
      
      // Connect to the MongoDB server
       await client.connect();
      
       // Access the database and collection
       const database = client.db('cricwwwdb');
       const collection = database.collection('upcoming');
       const wcupCollection = database.collection('worldcup');
       const recentMatchesCollection = database.collection('recentMatches');
      
      // Fetch data from MongoDB
      const data = await collection.find({}).toArray();
      const wcup = await wcupCollection.find({}).toArray();
      const recent = await recentMatchesCollection.find({}).toArray();
      
       // Close the connection to the MongoDB server
       await client.close();

       const filteredFixture = data[0].res.matches
       const filteredFixtureData = filteredFixture.filter(item => item.srsKey === 'ipl_2024');
       const mensWcup = wcup[0].res.matches;
       const worldCupMatches = mensWcup.filter(item => item.srsKey === "t20_wc_2024");
           
        const recentRecord = recent[0].res.matches;
        const recentMatches = recentRecord.filter(item => item.srsKey === "t20_wc_2024" || item.srsKey === 'ipl_2024');
       // Send the fetched data as JSON in the response
       const wpl =[];
       res.render('./replica/rep-fixture', {recentMatches, worldCupMatches, filteredFixtureData, wpl, user})
   } catch (error) {
       console.error("Error fetching data from MongoDB:", error);
       res.status(500).json({ error: "Internal server error" });
   }
 });

 router.get('/cric-ranking', async function(req, res){
  const user = await req.user;
  // Connection URI for MongoDB
  const uri = "mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/";
      
  // Create a new MongoClient
  const client = new MongoClient(uri);
 
 // Connect to the MongoDB server
  await client.connect();
 
  // Access the database and collection
  const database = client.db('cricwwwdb');
  const mensBattingT20 = database.collection('mensBattingT20');
  const mensBattingODI = database.collection('mensBattingODI');
  const mensBattingTest = database.collection('mensBattingTest');
  const mensODITeam = database.collection('mensODITeam');
  const mensT20Team = database.collection('mensT20Team');
  const mensTestTeam = database.collection('mensTestTeam');


  //fetch data
  const batRankingx =  await mensBattingT20.find({}).toArray();
  const odiRankingx = await mensBattingODI.find({}).toArray();
  const testRankingx = await mensBattingTest.find({}).toArray();
  const oditeamRankingx = await mensODITeam.find({}).toArray();
  const t20teamRankingx = await mensT20Team.find({}).toArray();
  const testteamRankingx = await mensTestTeam.find({}).toArray();

  //main variable
  const batRanking = await batRankingx[0].data['bat-rank'].rank;
  const odiRanking = await odiRankingx[0].data['bat-rank'].rank;
  const testRanking = await testRankingx[0].data['bat-rank'].rank;
  const oditeamRanking = await oditeamRankingx[0].data['bat-rank'].rank;
  const t20teamRanking = await t20teamRankingx[0].data['bat-rank'].rank;
  const testteamRanking = await testteamRankingx[0].data['bat-rank'].rank;

  //adding data to variable
  res.render('./replica/rep-ranking', {batRanking, odiRanking, testRanking, oditeamRanking, t20teamRanking, testteamRanking, user})
 });

 router.get('/cric-stats-corner', async function(req, res){
  const user = req.user;
   // Connection URI for MongoDB
   const uri = "mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/";
      
   // Create a new MongoClient
   const client = new MongoClient(uri);
  
  // Connect to the MongoDB server
   await client.connect();
  
   // Access the database and collection
   const database = client.db('cricwwwdb');
   const iplPointsTable = database.collection('iplPointsTable');
 
   //fetch data
   const iplPointsTablex =  await iplPointsTable.find({}).toArray();
  
   //main variable
   const iplPoints= await iplPointsTablex[0].res.series.points[0].teams;
   const wplPoints = []

   res.render('./replica/rep-stats', {wplPoints, iplPoints, user})
 })

 router.get('/cric-prediction', async function(req, res) {
  try {
     
     const user = req.user; // Assuming the authenticated user is stored in req.user
     console.log(user)
     // Connection URI for MongoDB
     const uri = "mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/";
      
     // Create a new MongoClient
     const client = new MongoClient(uri);
    
    // Connect to the MongoDB server
     await client.connect();
    
     // Access the database and collection
     const database = client.db('cricwwwdb');
     const collection = database.collection('upcoming');
     const predict = await axios('http://45.129.86.137:3000/api/comments');
     const predictData = predict.data.data;
   

      // Fetch data from MongoDB
      const data = await collection.find({}).toArray();

      // Close the connection to the MongoDB server
       await client.close();

       const filteredFixture = data[0].res.matches
       const filteredFixtureData = filteredFixture.filter(item => item.srsKey === 'ipl_2024');

      const teamone = filteredFixtureData[0].teams.t1.sName;
      const teamtwo = filteredFixtureData[0].teams.t2.sName;

      res.render('./replica/rep-prediction', {filteredFixtureData, teamone, teamtwo, predictData, user});
  } catch (error) {
    console.error("Error fetching data from MongoDB:", error);
    res.status(500).json({ error: "Internal server error" });
  }
 })

router.get('/cric-predict-data',isLoggedInRep, async (req, res) => {
  const user = req.user;
  // Connection URI for MongoDB
  const uri = "mongodb+srv://useretheharsh2211:kDeRLJIEezx8yYGB@cluster0.7fob7mc.mongodb.net/";
     
  // Create a new MongoClient
  const client = new MongoClient(uri);
 
 // Connect to the MongoDB server
  await client.connect();
 
  // Access the database and collection
  const database = client.db('cricwwwdb');
  const collection = database.collection('recentMatches');

  // Fetch data from MongoDB
  const data = await collection.find({}).toArray();

  // Close the connection to the MongoDB server
   await client.close();

   const recent = data[0].res.matches


const response = await axios('http://45.129.86.137:3000/api/comments');
const recentRecord = recent;
const recentMatches = recentRecord.filter(item => item.srsKey === "mens_t20_wc_2024" || item.srsKey === 'ipl_2024');
const comments = response.data.data;

res.render('./replica/rep-pdata', {comments, recentMatches, user});

})

router.get('/cric-login', async function(req, res){
  const user = req.user
  res.render('./replica/rep-login', {user});
})

/* LOGIN ROUTE */
router.post(
  "/cric-signin",
  passport.authenticate("local", {
    successRedirect: "/cric-prediction",
    failureRedirect: "/cric-login",
    failureFlash: true,
  }),
  function (req, res, next) {
    res.redirect("/cric-login");
  }
);

/* LOGOUT ROUTE */
router.get("/cric-logout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/cric-home");
  });
});

/* MIDDLEWARE */
function isLoggedInRep(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect("/cric-login");
  }
}

router.get('/cric-blog/:id', async (req, res) => {
  const user = req.user;
  const id = req.params.id
  const response = await axios(`http://45.129.86.137:3000/api/posts/${id}?populate=*`);
  const allResponse = await axios('http://45.129.86.137:3000/api/posts/?populate=*');
  const blogPostData = response.data;
  const singlePost = blogPostData.data;
  const Blog = allResponse.data;
  const recentBlog = Blog.data;
 const richText = singlePost.attributes.des;

  function jsonToHtml(jsonData) {
    let html = "";
  
    function processNode(node) {
      switch (node.type) {
        case "heading":
          html += `<h${node.level}>${processNode(node.children[0])}</h${node.level}>`;
          break;
        case "paragraph":
          html += `<p>${node.children.map(processNode).join("")}</p>`;
          break;
        case "list":
          const listType = node.format === "ordered" ? "ol" : "ul";
          html += `<${listType}>`;
          html += node.children.map(processNode).join("");
          html += `</${listType}>`;
          break;
        case "list-item":
          html += `<li>${processNode(node.children[0])}</li>`;
          break;
        case "text":
          let text = node.text;
          if (node.bold) {
            text = `<strong>${text}</strong>`;
          }
          if (node.italic) {
            text = `<i>${text}</i>`;
          }
          if (node.underline) {
            text = `<u>${text}</u>`;
          }
          if (node.strikethrough) {
            text = `<s>${text}</s>`;
          }
          return text;
        case "image":
          html += `<img style="width: 50vw;" src="${node.image.url}" alt="${node.image.alternativeText}" />`;
          break;
        case "quote":
          html += `<blockquote>${processNode(node.children[0])}</blockquote>`;
          break;
        case "link":
          html += `<a href="${node.url}">${processNode(node.children[0])}</a>`;
          break;
        default:
          break;
      }
    }
  
    jsonData.forEach(processNode);
    return html;
  }
  const jsonData = richText;
  const htmlContent = jsonToHtml(jsonData); 

  res.render('./replica/rep-blog', {singlePost, recentBlog, htmlContent, user})
})


const scoreCardData = async (id, link) => {
 
  try {
    const response = await axios.get(`https://www.cricbuzz.com/live-cricket-scorecard/${id}/${link}`);
    const body = response.data; // Get the response body directly
    const $ = cheerio.load(body);

    const wrapper1 = $('#innings_1 > .cb-ltst-wgt-hdr');
    const firstInnings = wrapper1.find('.cb-scrd-hdr-rw').text();

    const wrapper2 = $('#innings_2 > .cb-ltst-wgt-hdr');
    const secondInnings = wrapper2.find('.cb-scrd-hdr-rw').text();

    let innings1Data = [];
    let innings2Data = [];

    // Scrape data for innings 1
    $('#innings_1 > .cb-ltst-wgt-hdr').each((index, element) => {
      const $element = $(element);
      const items = $element.find('.cb-scrd-itms');

      items.each((index, item) => {
        const $item = $(item);
        const playerName = $item.find('.cb-col-25 a').text().trim();

        if (playerName) {
          const dismissal = $item.find('.cb-col-33').text().trim();
          const runs = $item.find('.cb-col-8.text-right.text-bold').text().trim();
          const balls = $item.find('.cb-col-8.text-right').eq(1).text().trim();
          const fours = $item.find('.cb-col-8.text-right').eq(2).text().trim();
          const sixes = $item.find('.cb-col-8.text-right').eq(3).text().trim();
          const strikeRate = $item.find('.cb-col-8.text-right').eq(4).text().trim();
          const didNotBat = items.find('.cb-col-73.cb-col').text().trim();

          innings1Data.push({
            playerName,
            dismissal,
            runs,
            balls,
            fours,
            sixes,
            strikeRate,
            didNotBat
          });
        }
      });
    });

    // Scrape data for innings 2
    $('#innings_2 > .cb-ltst-wgt-hdr').each((index, element) => {
      const $element = $(element);
      const items = $element.find('.cb-scrd-itms');

      items.each((index, item) => {
        const $item = $(item);
        const playerName = $item.find('.cb-col-25 a').text().trim();

        if (playerName) {
          const dismissal = $item.find('.cb-col-33').text().trim();
          const runs = $item.find('.cb-col-8.text-right.text-bold').text().trim();
          const balls = $item.find('.cb-col-8.text-right').eq(1).text().trim();
          const fours = $item.find('.cb-col-8.text-right').eq(2).text().trim();
          const sixes = $item.find('.cb-col-8.text-right').eq(3).text().trim();
          const strikeRate = $item.find('.cb-col-8.text-right').eq(4).text().trim();
          const didNotBat = items.find('.cb-col-73.cb-col').text().trim();

          innings2Data.push({
            playerName,
            dismissal,
            runs,
            balls,
            fours,
            sixes,
            strikeRate,
            didNotBat
          });
        }
      });
    });
// bowlers data --->
let innings1BowlerData = [];
let innings2BowlerData = [];

// Scrape data for innings 1 bowlers
$('#innings_1 > .cb-col.cb-col-100.cb-ltst-wgt-hdr').each((index, element) => {
  const $element = $(element);
  const items = $element.find('.cb-scrd-itms');

  items.each((index, item) => {
    const $item = $(item);
    const bowlerName = $item.find('.cb-col-38 a').text().trim();

    if (bowlerName) {
      const overs = $item.find('.cb-col-8.text-right').eq(0).text().trim();
      const maidens = $item.find('.cb-col-8.text-right').eq(1).text().trim();
      const runsGiven = $item.find('.cb-col-10.text-right').eq(0).text().trim();
      const wickets = $item.find('.cb-col-8.text-right.text-bold').text().trim();
      const noBalls = $item.find('.cb-col-8.text-right').eq(2).text().trim();
      const wides = $item.find('.cb-col-8.text-right').eq(3).text().trim();
      const economy = $item.find('.cb-col-10.text-right').eq(1).text().trim();

      innings1BowlerData.push({
        bowlerName,
        overs,
        maidens,
        runsGiven,
        wickets,
        noBalls,
        wides,
        economy,
      });
    }
  });
});

// Scrape data for innings 2 bowlers
$('#innings_2 > .cb-col.cb-col-100.cb-ltst-wgt-hdr').each((index, element) => {
  const $element = $(element);
  const items = $element.find('.cb-scrd-itms');

  items.each((index, item) => {
    const $item = $(item);
    const bowlerName = $item.find('.cb-col-38 a').text().trim();

    if (bowlerName) {
      const overs = $item.find('.cb-col-8.text-right').eq(0).text().trim();
      const maidens = $item.find('.cb-col-8.text-right').eq(1).text().trim();
      const runsGiven = $item.find('.cb-col-10.text-right').eq(0).text().trim();
      const wickets = $item.find('.cb-col-8.text-right.text-bold').text().trim();
      const noBalls = $item.find('.cb-col-8.text-right').eq(2).text().trim();
      const wides = $item.find('.cb-col-8.text-right').eq(3).text().trim();
      const economy = $item.find('.cb-col-10.text-right').eq(1).text().trim();

      innings2BowlerData.push({
        bowlerName,
        overs,
        maidens,
        runsGiven,
        wickets,
        noBalls,
        wides,
        economy,
      });
    }
  });
});

    return({
      firstInnings,
      secondInnings,
      innings1Data,
      innings2Data,
      innings1BowlerData,
      innings2BowlerData
    });
    
  } catch (error) {
    console.error("Error:", error);
  }
}


router.get('/api/scorecard', async (req, res) => {
  try {
    const data = await scoreCardData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
})


router.get('/scorecard/:id/:link', async (req, res) => {
  const user = req.user;
  const id = req.params.id;
  const link = req.params.link;
  const allResponse = await axios('http://45.129.86.137:3000/api/posts/?populate=*');
  const Blog = allResponse.data;
  const recentBlog = Blog.data;

  const scoreData = await scoreCardData(id, link);

  // const scoreCardData = await axios('http://localhost:3000/api/scorecard')
  // const scoreData = scoreCardData.data;
  

  res.render('scorecard', {recentBlog, user, scoreData})
  //res.send(scoreData);
})

router.get('/cric-scorecard/:id/:link', async (req, res) => {
  const user = req.user;
  const id = req.params.id;
  const link = req.params.link;
  const allResponse = await axios('http://45.129.86.137:3000/api/posts/?populate=*');
  const Blog = allResponse.data;
  const recentBlog = Blog.data;

  const scoreData = await scoreCardData(id, link);

  // const scoreCardData = await axios('http://localhost:3000/api/scorecard')
  // const scoreData = scoreCardData.data;
  

  res.render('./replica/rep-scorecard', {recentBlog, user, scoreData})
})

router.get('/cric-nextPage', resetIfInactive, async (req, res) => {
  const response = await axios('http://45.129.86.137:3000/api/posts?populate=*');
  const allPosts = response.data.data;

  if (req.session.endIndex < allPosts.length) {
      req.session.startIndex += 3;
      req.session.endIndex += 3;
  } else {
      req.session.startIndex = 0;
      req.session.endIndex = 3;
  }

  res.redirect('/cric-home');
});

router.get('/cric-prevPage',resetIfInactive, async (req, res) => {
  const response = await axios('http://45.129.86.137:3000/api/posts?populate=*');
  const allPosts = response.data.data;

  if (req.session.startIndex > 0) {
      req.session.startIndex -= 3;
      req.session.endIndex -= 3;
  }

  res.redirect('/cric-home');
});

router.get('/recent-match', async function(req, res) {
  try {
    const user = await req.user;
    const recentMatchData = await scrapeRecentData();
    const filteredMatches = recentMatchData.filter(match => {
      const teams = ['CSK', 'MI', 'GT', 'RR', 'KKR', 'SRH', 'RCB', 'LSG', 'DC', 'PBKS'];
      return teams.some(team => match.team1.includes(team));
    });

    res.render('recentmatches', {user, filteredMatches})
    //res.send(filteredMatches)
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

var directory  = require('../public/api/matchresults.json')

router.get('/anime', async function(req, res){
  //prediction data
  const prediction = await axios('http://45.129.86.137:3000/api/comments?populate=*')
  const data = prediction.data.data;
  const team1Values = data.map(item => item.attributes.Team1);

          // Read data from local JSON file
          const filePath = path.join(__dirname, '../public/api/matchresults.json');
          const fsdata = fs.readFileSync(filePath, 'utf8');
          const jsonData = JSON.parse(fsdata);
  
res.send(jsonData)
// res.render('anime', {recentMatches, data})

})

module.exports = router;
