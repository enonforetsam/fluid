/* Local UI adapter for the bundled Fluid v3.3 studio. MIT. */
(function () {
  'use strict';
  var mode = new URLSearchParams(window.location.search).get('mode');
  if (!window.FluidStudio || !/^(text|logo|photo|camera)$/.test(mode || '')) return;
  requestAnimationFrame(function () { requestAnimationFrame(function () {
    window.FluidStudio.openMode(mode);
  }); });
})();
