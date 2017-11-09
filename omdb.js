// OMDb API: http://www.omdbapi.com/?i=tt3896198&apikey=47dce8d4

var request = require('request');

function searchFilm(search_s, str = false) {
  return get({"t": search_s}, str)
}

function get(opt, str) {
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
          if (str) resolve(JSON.stringify(o, null, '  '))
          else resolve(o)
        } else {
          reject({opt: opt, err: "Arg pb with OMDB API..."})
        }
      }
    });
  })
}

function normFileTitle(fname) {
  // normalises a film filename (like The.Sound.of.Music.1965.720p.BRrip.x264.YIFY) to search in omdb (=> the sound of music)
  var arr = "director\\'?s?\\scut|720p|1080p|yify|x264|x265|h264|bokutox|release|rarbg|bd\\s?rip|remastered|vostfr|vost|divx|yts[\\s\\.\\_\\-]?pe|yts[\\s\\.\\_\\-]?ag|bluray|dvd|brrip|xvid|10bit|hevc|hdtv\\s?rip|web\\s?dl|dual\\s?audio|x0r|mkv|mp4|anoxmous"
  var s = fname
  arr.split("|").forEach(el => {
    s = s.replace(new RegExp(el, "gi"), "")
  })
  s = s.replace(/[\s\-_\:\.](EXTENDED|ExD|Deceit|MgB|ViSiON|GAZ|RmD|AC3\-?|Zen_Bud|ETRG)($|[\s\_\.\-])/g, "")
  s = s.replace(/[\[\]\(\)]/gi, "")
  s = s.replace(/(19|20)[0-9]{2}/gi, "")
  s = s.replace(/[\s\.\-\_](FR|RU|aac|rip|french|subs|hdscene)([\s\.\-\_]|$)/gi, "")
  s = s.replace(/\.(mp4|mkv|avi|webm|flv|ogv|mov|mpg|mpeg|m4v|3gp)$/gi, "")
  s = s.replace(/[\.\_]/gi, " ")
  s = s.replace(/\s\s+/gi, " ")
  return s.trim()
}

module.exports.get = get;
module.exports.searchFilm = searchFilm;

module.exports.normFileTitle = normFileTitle;
