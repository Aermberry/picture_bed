(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('.toc nav a'));
  if (!links.length || !('IntersectionObserver' in window)) return;

  var map = {};
  links.forEach(function (a) {
    var id = a.getAttribute('href').slice(1);
    var el = document.getElementById(id);
    if (el) map[id] = a;
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      links.forEach(function (a) { a.classList.remove('active'); });
      var a = map[entry.target.id];
      if (a) a.classList.add('active');
    });
  }, { rootMargin: '-20% 0px -65% 0px', threshold: 0 });

  Object.keys(map).forEach(function (id) {
    observer.observe(document.getElementById(id));
  });
})();
