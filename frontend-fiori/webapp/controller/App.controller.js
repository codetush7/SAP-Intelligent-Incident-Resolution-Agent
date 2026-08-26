sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "cpi/incidentagent/services/ApiService"
], function (Controller, ApiService) {
  "use strict";

  return Controller.extend("cpi.incidentagent.controller.App", {
    onInit: function () {
      // Fetch current user for the shell header (mirrors AuthContext's /auth/me call)
      if (ApiService.getToken()) {
        ApiService.auth.me().then(function (data) {
          var oAppModel = this.getOwnerComponent().getModel("app");
          var user = data.user || data;
          var initials = (user.name || user.email || "U")
            .split(" ").map(function (p) { return p[0]; }).join("").slice(0, 2).toUpperCase();
          oAppModel.setProperty("/user", Object.assign({}, user, { initials: initials }));
        }.bind(this)).catch(function () {
          // token invalid/expired — ApiService's request layer already redirects to #/login
        });
      }
    },

    onToggleSideNav: function () {
      var oToolPage = this.byId("toolPage");
      oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
    },

    onNavItemSelect: function (oEvent) {
      var sKey = oEvent.getParameter("item").getKey();
      if (sKey === "logout") {
        ApiService.setToken(null);
        this.getOwnerComponent().getModel("app").setProperty("/user", null);
        this.getOwnerComponent().getRouter().navTo("login");
        return;
      }
      this.getOwnerComponent().getModel("app").setProperty("/activePage", sKey);
      this.getOwnerComponent().getRouter().navTo(sKey);
    },

    onNotificationsPress: function (oEvent) {
      // Hook point for a notification popover fragment backed by app>/notifications,
      // populated by the same WebSocket events the React app currently listens to
      // (ticket_created, new_alert, agent_activity) via a shared WebSocketService.
    },

    onUserPress: function () {
      // Hook point for a user/profile popover fragment.
    }
  });
});
