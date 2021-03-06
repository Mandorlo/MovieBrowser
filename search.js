const path = require('path');
const _ = require('lodash');
const removeDiacritics = require('diacritics').remove;
const dblib = require('./db.js');

const classes_eq = [
  ['drole', 'humour', 'comedie'],
  ['histoire', 'historique'],
  ['romance', 'romantique'],
  ['sci-fi', 'science fiction']
];

var omdb_fields = {
  "Actors": getOMDBField(dblib.db, "Actors"),
  "Genre": getOMDBField(dblib.db, "Genre"),
  "Director": getOMDBField(dblib.db, "Director"),
  "Title": getOMDBField(dblib.db, "Title")
}

function commands(film_list, search_s) {
  console.log("Processing command " + search_s + "...")
  if (search_s == "@noposter") {
    var res = _.filter(film_list, m => (!m.localPoster && !(m.omdb && m.omdb.localPoster)))
    console.log(res.length, film_list.length)
    return res
  } else if (search_s == "@noomdb") {
    var res = _.filter(film_list, m => !m.omdb);
    return res
  } else if (/\@last\s+[0-9]+/gi.test(search_s)) {
    var nb = parseInt(/[0-9]+/gi.exec(search_s))
    console.log("get last " + nb + " films")
    return film_list.slice(-nb-1)
  } else {
    console.log("command not recognized, commands : @noposter, @noomdb")
    norify("ERROR: possible cmd are @noposter, @noomdb, @last x")
    return film_list
  }
}

function searchFilm(film_list, search_s) {
  if (!search_s || search_s.length < 3) return film_list;
  // commandes spéciales
  if (search_s[0] == "@") return commands(film_list, search_s)

  // returns the list of film_o that match search_s
  search_s = normString(search_s)
  var films_notes = [];

  film_list.forEach(film_o => {
    film_o.note = compareFilm2String(film_o, search_s)
    films_notes.push(film_o)
  })

  var notes = _.map(films_notes, 'note');
  var e = ecartType(notes);
  var mini = _.max(notes) - 3 * e;
  console.log("Ecart-type for search = ", e)
  console.log("Limit for search = ", mini)
  var filter_film = _.filter(films_notes, f => f.note >= mini)
  return _.sortBy(filter_film, "note").reverse()
}

function ecartType(arr) {
  var m = mean(arr);
  var arr2 = _.map(arr, n => Math.pow(n - m, 2));
  return Math.sqrt(mean(arr2));
}

function mean(arr) {
  var somme = 0.0;
  somme = _.reduce(arr, (res, n) => {
    return res + n
  }, 0)
  return somme / parseFloat(arr.length)
}


function compareFilm2String(film_o, s) {
  if (!film_o || !film_o.path) throw "L'objet film envoyé dans compareFilm2String du module search.js est invalide !";

  s = normString(s);
  var note = 0;
  // on regarde le titre
  var title = dblib.getTitle(film_o);
  note += compareStrings(title, s) * 2;

  // recherche par années
  if (/^(20|19)[0-9]{2}$/gi.test(s) && film_o.omdb && film_o.omdb.Year) {
    if (film_o.omdb.Year == s) return 1000;
    else return 0;
  } else if (/(ann[ée]es|years?)\s+[0-9]+/gi.test(s) && film_o.omdb && film_o.omdb.Year) {
    var year_base = /[0-9]+/gi.exec(s);
    if (year_base) {
      year_base = parseInt(year_base)
      if (year_base >= 40 && year_base < 100) year_base = 1900 + year_base;
      else if (year_base < 40) year_base = 2000 + year_base;
      // console.log("search by year detected", year_base, parseInt(film_o.omdb.Year), parseInt(film_o.omdb.Year) - year_base > 0 && parseInt(film_o.omdb.Year) < 10)
      if (parseInt(film_o.omdb.Year) - year_base > 0 && parseInt(film_o.omdb.Year) - year_base < 10) return 1000;
      else return 0;
    }
  }

  // cas particuliers
  var stop = false
  for (var k in omdb_fields) {
    if (omdb_fields[k].indexOf(s) >= 0 && !stop) {
      if (film_o.omdb && film_o.omdb[k]) {
        var new_note = compareStrings(film_o.omdb[k], s) * 1.5;
        note += new_note;
        if (new_note > 100) stop = true
      }
    }
  }

  if (film_o.tags) note += compareStrings(film_o.tags.join(' '), s) / 2;
  if (film_o.omdb) {
    if (film_o.omdb.Genre) note += compareStrings(film_o.omdb.Genre, s) / 2;
    if (film_o.omdb.Director) note += compareStrings(film_o.omdb.Director, s) / 2;
    if (film_o.omdb.Actors) note += compareStrings(film_o.omdb.Actors, s) / 4;
    if (film_o.omdb.Country) note += compareStrings(film_o.omdb.Country, s) / 2;
    if (film_o.omdb.Language) note += compareStrings(film_o.omdb.Language, s) / 2;
    if (film_o.omdb.Production) note += compareStrings(film_o.omdb.Production, s) / 2;
    if (film_o.omdb.Awards) note += compareStrings(film_o.omdb.Awards, s) / 10;
  }

  if (film_o.path.indexOf("attopardo") >= 0) console.log("res gatto: ", note);
  return note
}


function compareStrings(s1, ns2) { // renvoie une note de similtude entre s1 et s2
  // ns2 is a string already normalized
  s1 = normString(s1);
  s2 = ns2
  var note = 0

  if (s1.indexOf(s2) >= 0 || s2.indexOf(s1) >= 0) note += 1000
  var arr_s1 = s1.split(' ');
  arr_s1.forEach(mot => {
    if (mot.length > 2 && mot == s2) note += 100
    else if (mot.length > 2 && (mot.indexOf(s2) >= 0 || s2.indexOf(mot) >= 0)) note += 10
  })

  var arr_s2 = s2.split(' ');
  arr_s2.forEach(mot => {
    if (mot.length > 2 && mot == s1) note += 100
    else if (mot.length > 2 && (mot.indexOf(s1) >= 0 || s1.indexOf(mot) >= 0)) note += 10
  })

  return note
}

function normString(s) {
  var news = removeDiacritics(s).toLowerCase();
  news = news.replace(/(\s|^)(des?|'s|of|the|est|les?|[ui]n[ae]?|for|la|ils?|[a-z]|qu[ei']|et|o[uù]|car)(\s|$)/gi, " ")
  news = news.replace(/([^A-z0-9\s]|[\\_])/gi, "")
  news = news.replace(/\s\s+/gi, " ")
  return news
}




function getOMDBField(movie_list, field) {
  var res = _.map(movie_list, m => {
    if (m.omdb && m.omdb[field]) {
      return _.map(m.omdb[field].split(', '), normString)
    } else {
      return []
    }
  });
  res = _.uniq(_.flattenDeep(res))
  return res
}

// test
// var test_s = "Aé âg  ç.-\\_x$£*"
// console.log(test_s, "=>", normString(test_s))
// var res = searchFilm(dblib.db, "poulain")
// console.log(_.map(res, "path"))


module.exports.searchFilm = searchFilm;
// module.exports.compareStrings = compareStrings;
