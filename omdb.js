// OMDb API: http://www.omdbapi.com/?i=tt3896198&apikey=47dce8d4

var request = require('request');

function searchFilm(search_s) {
  return get({"t": search_s})
}

function get(opt) {
  var myurl = "http://www.omdbapi.com/?apikey=47dce8d4";
  for (var k in opt) {
    myurl += "&" + k + "=" + encodeURI(opt[k])
  }

  return new Promise((resolve, reject) => {
    request(myurl, function(error, response, body) {
      if (error) {
        reject({opt: opt, err: error})
        return
      } else if (response && response.statusCode != 200) {
        reject({opt: opt, err: response})
      } else if (response && response.statusCode == 200) {
        try {
          var o = JSON.parse(body);
        } catch(e) {
          reject({opt: opt, err: e})
        }
        if (o && o.Response && o.Response == "False") {
          reject({opt: opt, err: o})
        } else if (o && o.Response && o.Response == "True") {
          resolve(o)
        } else {
          reject({opt: opt, err: "Arg pb with OMDB API..."})
        }
      }
    });
  })
}

function normFileTitle(fname) {
  // normalises a film filename (like The.Sound.of.Music.1965.720p.BRrip.x264.YIFY) to search in omdb (=> the sound of music)
  var s = fname.replace(/(720p|1080p|yify|x264)/gi, "")
  s = s.replace(/\.(mp4|mkv|avi|webm|flv|ogv|mov|mpg|mpeg|m4v|3gp)$/gi, "")
  s = s.replace(/\./gi, " ")
  return s
}

module.exports.get = get;
module.exports.searchFilm = searchFilm;

module.exports.normFileTitle = normFileTitle;
