function zoomIn(alpha = 1.05) {
  // on agrandit le conteneur (posters)
  var list_cards = $('.main_container');
  var w = list_cards.eq(0).width()
  var h = list_cards.eq(0).height()
  var font_size = parseInt(mt.eq(0).css("font-size"))

  if (w > 800 || h > 800) {
    console.log("Trop grand ! Je bloque le zoom in !")
    return
  }

  list_cards.css('width', Math.round(w * alpha).toString() + "px")
  list_cards.css('height', Math.round(h * alpha).toString() + "px")

  // on agrandit la taille de la police
  var mt = $('.main_title');
  if (font_size < 100) mt.css('font-size', (font_size + 2).toString() + "px");
  else console.log("font max size reached !")
}

function zoomOut(alpha = 1.05) {
  // on réduit le conteneur (posters)
  var list_cards = $('.main_container');
  var w = list_cards.eq(0).width()
  var h = list_cards.eq(0).height()

  if (w < 50 || h < 70) {
    console.log("Trop petit ! Je bloque le zoom in !")
    return
  }

  list_cards.css('width', Math.round(w / alpha).toString() + "px")
  list_cards.css('height', Math.round(h / alpha).toString() + "px")

  // on réduit la taille de la police
  var mt = $('.main_title');
  var font_size = parseInt(mt.eq(0).css("font-size"))
  if (font_size > 6) mt.css('font-size', (font_size - 2).toString() + "px");
  else console.log("font min isze reached !")
}

module.exports.zoomIn = zoomIn;
module.exports.zoomOut = zoomOut;
