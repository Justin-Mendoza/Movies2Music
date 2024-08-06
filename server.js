const express = require("express");
const path = require("path");
const app = express();
const querystring = require("querystring");
const axios = require("axios");
const { response } = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");

let movieName;

const PORT = process.env.PORT || 5000;

const clientID = "b1213f2555c84f16b98280f729125e6c";
const clientSecret = "56efc00095474ffc8c851da4d0502a39";
let accessToken =
  "BQB1Hbc3_Efbnn6DFmwbbttGdXorTmlcPBZ21D2udM1iWLEnQhUNE0XWLaPLE7gu3KxkcWNeZZteu-siG-BUnxHG0R6QTwD6zWYkLdUffibdgspOiUg";
let TMDBAccessToken = "324e7edb49748f6075631b059edae65c";
let TMDBReadAccessToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzMjRlN2VkYjQ5NzQ4ZjYwNzU2MzFiMDU5ZWRhZTY1YyIsIm5iZiI6MTcyMTA4NjUyNy43MjU1NzQsInN1YiI6IjY2OTVhMDU5MWU4MjVmZDg4ZTM1NzQwOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.pVawm_Efn-wmcz4eNBMFs4IxrnypoUxLtilCjtPOvIs";

const accessTokenLifeTime = 3600;
const accessTokentype = "bearer";
const index = "../URI/index.html";
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
let storedState = null;
let TOKEN_URL = "https://accounts.spotify.com/api/token";
var userID;

const user = null;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

app.use(
  express.json(),
  express.urlencoded({
    extended: true,
  }),
  bodyParser.urlencoded({ extended: true })
);
// APP HOME!!!!!!1

app.get("/", (req, res) => {
  // res.sendFile(path.join(__dirname, "/uri/index.html"));
  res.render("pages/index");
});
// APP LOGIN!!!!!!1

app.get("/login", async function (req, res) {
  const state = generateRandomString(16);
  storedState = state;
  const scope =
    "user-read-private user-read-email playlist-modify-public playlist-modify-private";

  try {
    // Redirect to Spotify's authorization page
    res.redirect(
      `https://accounts.spotify.com/authorize?${querystring.stringify({
        response_type: "code",
        client_id: clientID,
        scope: scope,
        redirect_uri: REDIRECT_URI,
        state: state,
      })}`
    );
  } catch (error) {
    console.error("There was a problem with the redirect operation: ", error);
    res.status(500).send("Error initiating Spotify login");
  }
});

// APP CALLBACK!!!!!!1

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!state || state !== storedState) {
    return res.json(400, { error: 1, msg: "could not validate" });
  }

  try {
    const response = await axios.post(TOKEN_URL, null, {
      params: {
        code: code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        client_id: clientID,
        client_secret: clientSecret,
      },
    });

    const accessToken = response.data.access_token;
    const refreshToken = response.data.refresh_token;

    // res.json({
    //   access_token: accessToken,
    //   refresh_token: refreshToken,
    // });
    res.redirect("/search");
  } catch (error) {
    console.error(
      "Error exchanging authorization code for tokens:",
      error.message
    );
    res
      .status(500)
      .json({ error: "Failed to exchange authorization code for tokens" });
  }
});
// APP SEARCH!!!!!!1
app.get("/search", async (req, res) => {
  res.render("pages/search");
});

app.post("/submit", async (req, res) => {
  movieName = req.body.inputText;
  console.log("Received input:", movieName);
  try {
    const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURI(
      movieName
    )}&include_adult=false&language=en-US&page=1&max-results=5`;
    const options = await {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${TMDBReadAccessToken}`,
      },
    };
    const apiResponse = await fetch(url, options);
    const jsonData = await apiResponse.json();

    // fetch paramaters
    // fetch(url, options)
    //   .then((res) => res.json())
    //   .then((json) => console.log(json))
    //   .catch((err) => console.error("error:" + err));

    const results = jsonData.results.slice(0, 5); //results its the json array with ALLL info

    res.render("pages/submit", { movieName, results });
  } catch (error) {
    console.error("Error fetching data from API:", error);
    res.status(500).send("Error fetching data from API");
  }
  //res.render("pages/search");
});

app.post("/movie", async (req, res) => {
  const movieId = req.body.movieId;

  // processing and findint the external imdb id using the tmbd id

  const imdbId = await getIMDBid(movieId);
  // with imdb external id, we can use that to  retrieve the json file of the movie we want

  const movieJSON = await getMovieJSON(imdbId);

  var jsonData;
  var reference;
  var referenceTracks;
  var album = true;

  //spotify ssearch
  try {
    movieName = encodeURI(movieJSON.title + " soundtrack");
    const apiResponse = await axios.get(
      //returns array
      `https://api.spotify.com/v1/search?q=${movieName}&type=album%2Cplaylist&limit=1`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    movieName = movieJSON.title + " movie soundtrack";
    console.log(movieName);

    // if (apiResponse.status != 200) {
    //   throw new Error("Network response was not OK" + apiResponse.status);
    // }

    jsonData = await apiResponse.data;
    // console.log(jsonData);
  } catch (error) {
    console.error("There was a problem with the fetch operation: ", error);

    res.status(500).send("Error fetching data from Spotify API");
  }

  if (
    jsonData.albums.items[0]
    // && jsonData.albums.items[0].name.includes(movieJSON.title)
  ) {
    reference = jsonData.albums.items[0].id;
    // } else if (jsonData.playlists.items[0]) {
    //   reference = jsonData.playlists.items[0].id;
    //   album = false;
  } else {
    throw new Error("No relevant album or playlist found");
  }

  //reference, find album tracks, find recommendations.
  if (album) {
    try {
      referenceTracksResponse = await fetch(
        `https://api.spotify.com/v1/albums/${reference}/tracks`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );

      if (!referenceTracksResponse.ok) {
        throw new error("ERROR: could not find album");
      }

      referenceTracks = await referenceTracksResponse.json();
      // console.log(referenceTracks);
    } catch (error) {
      console.error("Error: couldn't fetch reference tracks", error);
      throw error("ERROR: couldnt start reference track resposne");
    }

    songSample = referenceTracks.items[2].id;

    //need user ID to create playlist

    audioFeatures = await getAudioAnalysis(songSample);

    recommendedPlaylist = await getRecommendations(audioFeatures);
    console.log(recommendedPlaylist);

    // console.log(recommendedPlaylist);
  }

  // Handle the variables and render the page
  res.render("pages/movie", {
    movieJSON: movieJSON,
    jsonData: jsonData,
    recommendedPlaylist: recommendedPlaylist,
  });
});

app.post("/createPlaylist", async (req, res) => {
  const userID = req.body.inputText;
  res.render("pages/createPlaylist", { userID: userID });
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});

//FUNCTIONS!!!!

// async function getProfile() {
//   try {
//     const profileResponse = await axios.get("https://api.spotify.com/v1/me", {
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//         Accept: "application/json",
//       },
//     });

//     // Directly access the data from the axios response
//     const userProfile = await profileResponse.json();
//     console.log(userProfile);

//     const userID = userProfile.id;

//     return userID;
//   } catch (error) {
//     console.error(
//       "There was a problem with fetching the user profile: ",
//       error.message
//     );
//     throw error;
//   }
// }

function generateRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

axios.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response.status === 401) {
      try {
        const response = await axios.post(
          TOKEN_URL,
          `grant_type=client_credentials&client_id=${clientID}&client_secret=${clientSecret}`,
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );
        //assigning newToken from response
        const newTokenInfo = response.data.access_token;
        accessToken = newTokenInfo;
        //logging new accessToken
        console.log("AccessToken", newTokenInfo);
        //configuring headers so that we use the new AccessToken
        error.config.headers["Authorization"] = `Bearer ${newTokenInfo}`;
        return axios(error.config);
      } catch (error) {
        console.error("Error getting access token:", error.message);
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

app.get("/refresh_token", function (req, res) {
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        new Buffer.from(client_id + ":" + client_secret).toString("base64"),
    },
    form: {
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    },
    json: true,
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token,
        refresh_token = body.refresh_token;
      res.send({
        access_token: access_token,
        refresh_token: refresh_token,
      });
    }
  });
});

// trial for appget w axios

// app.get("/search", (req, res) => {
//   //await refresh
//   axios
//     .get("https://api.spotify.com/v1/me", {
//       headers: {
//         Authorization: "Bearer " + accessToken,
//       },
//     })
//     .then((response) => {
//       user = response.data;
//       userName = user.display_name;

//       res.render("pages/search", { userName });
//     })
//     .catch((error) => {
//       console.error(`error getting user data: ${error}`);
//       res.status(500).send(`Error getting user data${error}`);
//     });
// });

async function getIMDBid(id) {
  const url = `https://api.themoviedb.org/3/movie/${id}/external_ids`;
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: "Bearer " + TMDBReadAccessToken,
    },
  };

  try {
    const apiResponse = await fetch(url, options); //await
    if (!apiResponse.ok) {
      // Check if the response is OK
      throw new Error(`HTTP error! Status: ${apiResponse.status}`);
    }
    const jsonData = await apiResponse.json(); //await

    const imdbId = jsonData.imdb_id;
    return imdbId;
  } catch (error) {
    console.error("Error fetching IMDb ID:", error);
    throw error;
  }
}

async function getMovieJSON(imdbId) {
  const url = `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`;
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: "Bearer " + TMDBReadAccessToken,
    },
  };

  try {
    const apiResponse = await fetch(url, options);
    const jsonData = await apiResponse.json();

    const movieDetails = jsonData.movie_results[0];

    return movieDetails;
  } catch (err) {
    console.error("Error fetching IMDb Movie Details:", error);
    throw error;
  }
}

async function getAudioAnalysis(trackID) {
  trackAnalysisResponse = await fetch(
    `https://api.spotify.com/v1/audio-features/${trackID}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application.json",
      },
    }
  );

  trackAnalysis = await trackAnalysisResponse.json();

  const trackFeatures = {
    id: encodeURI(trackAnalysis.id),
    danceability: encodeURI(trackAnalysis.danceability),
    energy: encodeURI(trackAnalysis.energy),
    instrumentalness: encodeURI(trackAnalysis.instrumentalness),
    key: encodeURI(trackAnalysis.key),
    liveness: encodeURI(trackAnalysis.liveness),
    loudness: encodeURI(trackAnalysis.loudness),
    speechiness: encodeURI(trackAnalysis.speechiness),
    tempo: encodeURI(trackAnalysis.tempo),
    timeSignature: encodeURI(trackAnalysis.time_signature),
    valence: encodeURI(trackAnalysis.valence),
  };

  // console.log(trackFeatures);

  return trackFeatures;
}

async function getRecommendations(t) {
  // console.log(t);
  recommendationResponse = await fetch(
    `https://api.spotify.com/v1/recommendations?limit=7&seed_tracks=${t.id}&target_danceability=${t.danceability}&target_energy=${t.energy}&target_instrumentalness=${t.instrumentalness}&target_key=${t.key}&target_liveness=${t.liveness}&target_loudness=${t.loudness}&target_speechiness=${t.speechiness}&target_tempo=${t.tempo}&target_time_signature=${t.timeSignature}&target_valence=${t.valence}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      method: "GET",
    }
  );

  recommendations = await recommendationResponse.json();
  // console.log(recommendations);

  return recommendations;
}
