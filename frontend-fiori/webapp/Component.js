sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/Device",
  "cpi/incidentagent/model/models",
  "cpi/incidentagent/services/ApiService"
], function (UIComponent, Device, models, ApiService) {
  "use strict";

  return UIComponent.extend("cpi.incidentagent.Component", {
    metadata: { manifest: "json" },

    init: function () {
      // call parent init first
      UIComponent.prototype.init.apply(this, arguments);

      // set device model
      this.setModel(models.createDeviceModel(), "device");

      // app-wide model: auth state, notifications, connection status
      this.setModel(models.createAppModel(), "app");

      // initialize the router
      this.getRouter().initialize();

      // if no token, router will still resolve dashboard route;
      // ApiService's 401 interceptor handles redirect-to-login centrally,
      // so every view can assume it's only rendered when authenticated.
      if (!ApiService.getToken()) {
        this.getRouter().navTo("login");
      }
    }
  });
});
