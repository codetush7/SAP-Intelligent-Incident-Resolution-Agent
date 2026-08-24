sap.ui.define([
  "sap/ui/core/ComponentContainer"
], function (ComponentContainer) {
  "use strict";

  new ComponentContainer({
    name: "cpi.incidentagent",
    settings: { id: "cpiIncidentAgent" },
    async: true,
    manifest: true
  }).placeAt("content");
});
