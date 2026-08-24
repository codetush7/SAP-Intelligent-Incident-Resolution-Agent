sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "cpi/incidentagent/services/ApiService",
  "sap/m/MessageToast"
], function (Controller, JSONModel, ApiService, MessageToast) {
  "use strict";

  return Controller.extend("cpi.incidentagent.controller.Dashboard", {

    onInit: function () {
      this.setModel(new JSONModel({
        totalIncidents: 0,
        criticalIncidents: 0,
        failedIntegrations: 0,
        resolvedIncidents: 0,
        mttr: 0,
        mttd: 0,
        activeRemediation: 0,
        aiDetectedIssues: 0,
        recentIssues: [],
        errorMessage: null
      }), "dashboard");

      this.getOwnerComponent().getModel("app").setProperty("/activePage", "dashboard");
      this._loadStats();
    },

    setModel: function (oModel, sName) {
      this.getView().setModel(oModel, sName);
    },

    _loadStats: function () {
      var oAppModel = this.getOwnerComponent().getModel("app");
      var oDashboardModel = this.getView().getModel("dashboard");

      oAppModel.setProperty("/busy", true);
      oDashboardModel.setProperty("/errorMessage", null);

      ApiService.dashboard.getStats()
        .then(function (data) {
          // Backend returns dataStore.getStats() fields + monitoring + recentIssues;
          // map defensively since field names may evolve on the backend side.
          oDashboardModel.setData({
            totalIncidents: data.totalIncidents ?? data.total ?? 0,
            criticalIncidents: data.criticalIncidents ?? data.critical ?? 0,
            failedIntegrations: data.failedIntegrations ?? data.failed ?? 0,
            resolvedIncidents: data.resolvedIncidents ?? data.resolved ?? 0,
            mttr: data.mttr ?? 0,
            mttd: data.mttd ?? 0,
            activeRemediation: data.activeRemediation ?? 0,
            aiDetectedIssues: data.aiDetectedIssues ?? 0,
            recentIssues: data.recentIssues || [],
            errorMessage: null
          });
        })
        .catch(function (err) {
          oDashboardModel.setProperty("/errorMessage", err.message);
          MessageToast.show(err.message);
        })
        .finally(function () {
          oAppModel.setProperty("/busy", false);
        });
    },

    onRefresh: function () {
      this._loadStats();
    },

    onKpiPress: function () {
      this.getOwnerComponent().getRouter().navTo("incidents");
    },

    onIncidentPress: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("dashboard");
      var ticketNumber = oContext.getProperty("ticketNumber");
      this.getOwnerComponent().getRouter().navTo("incidentDetail", { ticketId: ticketNumber });
    },

    formatStatusState: function (sStatus) {
      var map = { OPEN: "Warning", IN_PROGRESS: "Warning", RESOLVED: "Success", CLOSED: "Success", FAILED: "Error" };
      return map[(sStatus || "").toUpperCase()] || "None";
    },

    formatPriorityState: function (sPriority) {
      var map = { CRITICAL: "Error", HIGH: "Error", MEDIUM: "Warning", LOW: "Success" };
      return map[(sPriority || "").toUpperCase()] || "None";
    },

    formatTimestamp: function (sTimestamp) {
      if (!sTimestamp) { return ""; }
      var oDate = new Date(sTimestamp);
      return isNaN(oDate.getTime()) ? sTimestamp : oDate.toLocaleString();
    }
  });
});
