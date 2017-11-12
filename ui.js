var busy = false;


function initUI() {
  window.addEventListener("keydown", e => {
    if (!busy && e.keyCode == 40) { // down arrow
      //window.scrollBy(0, $('.main_container').height()+$('#navbar').height()+20);
      e.preventDefault();
      // window.scrollBy(0, $('.main_container').height() + 55);
      busy = true;
      $("html, body").animate({
        scrollTop: $(window).scrollTop() + $('.main_container').height() + 55
      }, 300, 'swing', function() {
        busy = false;
      });
    } else if (!busy && e.keyCode == 38) { // up arrow
      e.preventDefault();
      busy = true;
      $("html, body").animate({
        scrollTop: $(window).scrollTop() - $('.main_container').height() - 55
      }, 300, 'swing', function() {
        busy = false
      });
      // window.scrollBy(0, -$('.main_container').height() - 55);
    }
  })

  $(document).keypress(e => {
    if (String.fromCharCode(e.which) == "s") {
      e.stopPropagation();
      $("#searchbox").focus();
      $("#searchbox").text("");
    } else if (String.fromCharCode(e.which) == "+") {
      ui.zoomIn()
    } else if (String.fromCharCode(e.which) == "-") {
      ui.zoomOut()
    } else {
      // console.log(String.fromCharCode(e.which))
    }
    // else if (String.fromCharCode(e.which) == "c" && e.ctrlKey) { // m <=> -
    //   app.renderDashboard();
    // }
  })
}

function zoomIn(alpha = 1.05) {
  // on agrandit le conteneur (posters)
  var list_cards = $('.main_container');
  var w = list_cards.eq(0).width()
  var h = list_cards.eq(0).height()

  if (w > 800 || h > 800) {
    console.log("Trop grand ! Je bloque le zoom in !")
    return
  }

  list_cards.css('width', Math.round(w * alpha).toString() + "px")
  list_cards.css('height', Math.round(h * alpha).toString() + "px")

  // on agrandit la taille de la police
  var mt = $('.main_title');
  var font_size = parseInt(mt.eq(0).css("font-size"));
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
  if (font_size > 11) mt.css('font-size', (font_size - 2).toString() + "px");
  else console.log("font min size reached !")
}



module.exports.initUI = initUI;
module.exports.zoomIn = zoomIn;
module.exports.zoomOut = zoomOut;
