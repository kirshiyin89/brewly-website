/*
 * Brewly Coffee – chat widget loader.
 *
 * Every page already loads this script, so the widget appears on all pages
 * without per-page changes. The script loads the modules in js/brewly-chat/.
 *
 * Optional configuration is read from this script tag:
 *
 *   <script src="js/chatbot.js" data-api-base="https://api.example.com"></script>
 *
 * data-api-base is the base URL of the ai-assistant backend.
 * It defaults to http://localhost:8080 for local development.
 */
(function () {
  "use strict";

  var DEFAULT_API_BASE = "http://localhost:8080";

  // document.currentScript is only set while this script runs, so read it now.
  var script = document.currentScript;
  if (!script) {
    return;
  }

  var apiBase = script.dataset.apiBase || DEFAULT_API_BASE;
  var widgetUrl = new URL("brewly-chat/widget.js", script.src).href;
  var cssUrl = new URL("brewly-chat/widget.css", script.src).href;

  import(widgetUrl)
    .then(function (widget) {
      widget.mountBrewlyChat({ apiBase: apiBase, cssUrl: cssUrl });
    })
    .catch(function (error) {
      console.error("Brewly chat widget could not be loaded.", error);
    });
})();
