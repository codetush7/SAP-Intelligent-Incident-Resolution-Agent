sap.ui.define([
  "sap/ui/model/json/JSONModel",
  "sap/ui/Device"
], function (JSONModel, Device) {
  "use strict";

  return {
    createDeviceModel: function () {
      var oModel = new JSONModel(Device);
      oModel.setDefaultBindingMode("OneWay");
      return oModel;
    },

    createAppModel: function () {
      // Shared app-wide state: current user, ws connection status, notifications.
      // Equivalent to the top-level state held in React's App.js / AuthContext.
      return new JSONModel({
        user: null,
        wsConnected: false,
        notifications: [],
        busy: false
      });
    }
  };
});
