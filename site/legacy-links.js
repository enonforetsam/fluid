/* Existing API, MCP and iframe links carry the complete artwork in their fragment. */
(function () {
  if (/^#(?:p|e)=/.test(location.hash)) {
    location.replace('/studio' + location.search + location.hash);
  }
}());
